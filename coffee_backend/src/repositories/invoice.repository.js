
const { sql, poolPromise } = require("../config/db");
const { randomUUID } = require("crypto");

// Lấy quy tắc tích điểm đang có hiệu lực
async function findActivePointRule() {
    const pool = await poolPromise;

    const result = await pool.request().query(`
        SELECT TOP 1 *
        FROM PointRules
        WHERE status = 'ACTIVE'
          AND startDate <= GETDATE()
          AND (endDate IS NULL OR endDate >= GETDATE())
        ORDER BY startDate DESC
    `);

    return result.recordset[0] || null;
}

// Tạo hóa đơn và chi tiết hóa đơn
async function createInvoice(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        // Kiểm tra khách hàng
        const customerResult = await new sql.Request(transaction)
            .input("customerId", sql.VarChar(36), data.customerId)
            .query(`
                SELECT userId
                FROM Customers
                WHERE userId = @customerId
            `);

        if (customerResult.recordset.length === 0) {
            const error = new Error("Không tìm thấy khách hàng");
            error.statusCode = 404;
            error.code = "CUSTOMER_NOT_FOUND";
            throw error;
        }

        // Kiểm tra nhân viên
        const staffResult = await new sql.Request(transaction)
            .input("staffId", sql.VarChar(36), data.staffId)
            .query(`
                SELECT userId
                FROM Staffs
                WHERE userId = @staffId
            `);

        if (staffResult.recordset.length === 0) {
            const error = new Error("Không tìm thấy nhân viên");
            error.statusCode = 404;
            error.code = "STAFF_NOT_FOUND";
            throw error;
        }

        // Lấy quy tắc tích điểm hiện hành
        const ruleResult = await new sql.Request(transaction).query(`
            SELECT TOP 1 ruleId
            FROM PointRules
            WHERE status = 'ACTIVE'
              AND startDate <= GETDATE()
              AND (endDate IS NULL OR endDate >= GETDATE())
            ORDER BY startDate DESC
        `);

        if (ruleResult.recordset.length === 0) {
            const error = new Error(
                "Hiện chưa có quy tắc tích điểm đang có hiệu lực"
            );
            error.statusCode = 409;
            error.code = "ACTIVE_POINT_RULE_NOT_FOUND";
            throw error;
        }

        const ruleId = ruleResult.recordset[0].ruleId;

        let totalAmount = 0;
        const invoiceDetails = [];

        // Kiểm tra sản phẩm và lấy giá từ database
        for (const item of data.items) {
            const productResult = await new sql.Request(transaction)
                .input("productId", sql.VarChar(36), item.productId)
                .query(`
                    SELECT productId, price
                    FROM Products
                    WHERE productId = @productId
                      AND status = 'ACTIVE'
                `);

            if (productResult.recordset.length === 0) {
                const error = new Error(
                    `Sản phẩm ${item.productId} không tồn tại hoặc đã ngừng kinh doanh`
                );
                error.statusCode = 404;
                error.code = "PRODUCT_NOT_FOUND";
                throw error;
            }

            const product = productResult.recordset[0];
            const unitPrice = Number(product.price);
            const quantity = item.quantity;

            // Discount mặc định bằng 0
            const discount = 0;

            const lineTotal = unitPrice * quantity - discount;

            totalAmount += lineTotal;

            invoiceDetails.push({
                productId: product.productId,
                quantity,
                unitPrice,
                discount
            });
        }

        totalAmount = Number(totalAmount.toFixed(2));

        const invoiceId = randomUUID();

        // Tạo hóa đơn
        await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .input("customerId", sql.VarChar(36), data.customerId)
            .input("staffId", sql.VarChar(36), data.staffId)
            .input("ruleId", sql.VarChar(36), ruleId)
            .input("totalAmount", sql.Decimal(18, 2), totalAmount)
            .query(`
                INSERT INTO Invoices (
                    invoiceId,
                    customerId,
                    staffId,
                    ruleId,
                    totalAmount,
                    totalPoint,
                    paymentStatus
                )
                VALUES (
                    @invoiceId,
                    @customerId,
                    @staffId,
                    @ruleId,
                    @totalAmount,
                    0,
                    'UNPAID'
                )
            `);

        // Tạo chi tiết hóa đơn
        for (const detail of invoiceDetails) {
            await new sql.Request(transaction)
                .input("invoiceDetailId", sql.VarChar(36), randomUUID())
                .input("invoiceId", sql.VarChar(36), invoiceId)
                .input("productId", sql.VarChar(36), detail.productId)
                .input("quantity", sql.Int, detail.quantity)
                .input("unitPrice", sql.Decimal(18, 2), detail.unitPrice)
                .input("discount", sql.Decimal(18, 2), detail.discount)
                .query(`
                    INSERT INTO InvoiceDetails (
                        invoiceDetailId,
                        invoiceId,
                        productId,
                        quantity,
                        unitPrice,
                        discount
                    )
                    VALUES (
                        @invoiceDetailId,
                        @invoiceId,
                        @productId,
                        @quantity,
                        @unitPrice,
                        @discount
                    )
                `);
        }

        await transaction.commit();

        return await findInvoiceById(invoiceId);
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {}

        throw error;
    }
}

// Xác nhận khách đã thanh toán tiền mặt
async function payInvoice(invoiceId) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        // Khóa hóa đơn trong lúc xử lý để tránh thanh toán hai lần
        const invoiceResult = await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .query(`
                SELECT *
                FROM Invoices WITH (UPDLOCK, HOLDLOCK)
                WHERE invoiceId = @invoiceId
            `);

        const invoice = invoiceResult.recordset[0];

        if (!invoice) {
            const error = new Error("Không tìm thấy hóa đơn");
            error.statusCode = 404;
            error.code = "INVOICE_NOT_FOUND";
            throw error;
        }

        if (invoice.paymentStatus !== "UNPAID") {
            const error = new Error(
                "Hóa đơn không ở trạng thái chưa thanh toán"
            );
            error.statusCode = 409;
            error.code = "INVOICE_ALREADY_PROCESSED";
            throw error;
        }

        // Lấy quy tắc đã được gắn với hóa đơn khi tạo
        const ruleResult = await new sql.Request(transaction)
            .input("ruleId", sql.VarChar(36), invoice.ruleId)
            .query(`
                SELECT pointRate, minimumAmount
                FROM PointRules
                WHERE ruleId = @ruleId
            `);

        if (ruleResult.recordset.length === 0) {
            const error = new Error("Không tìm thấy quy tắc tích điểm");
            error.statusCode = 404;
            error.code = "POINT_RULE_NOT_FOUND";
            throw error;
        }

        const rule = ruleResult.recordset[0];

        // Tính điểm cơ bản
        let basePoint = 0;

        if (Number(invoice.totalAmount) >= Number(rule.minimumAmount)) {
            basePoint = Math.floor(
                Number(invoice.totalAmount) / Number(rule.pointRate)
            );
        }

        // Tính điểm thưởng từ Promotion có hiệu lực
        const promotionResult = await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .query(`
                SELECT
                    COALESCE(
                        SUM(p.bonusPoint * d.quantity),
                        0
                    ) AS bonusPoint
                FROM InvoiceDetails d
                INNER JOIN Promotions p
                    ON p.productId = d.productId
                WHERE d.invoiceId = @invoiceId
                  AND p.status = 'ACTIVE'
                  AND LOWER(p.promotionType) = 'bonus_point'
                  AND p.startDate <= GETDATE()
                  AND p.endDate >= GETDATE()
            `);

        const bonusPoint = Number(
            promotionResult.recordset[0].bonusPoint
        );

        const totalPoint = basePoint + bonusPoint;

        // Cập nhật hóa đơn đã thanh toán
        await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .input("totalPoint", sql.Int, totalPoint)
            .query(`
                UPDATE Invoices
                SET
                    paymentStatus = 'PAID',
                    totalPoint = @totalPoint
                WHERE invoiceId = @invoiceId
            `);

        let pointTransactionId = null;

        // Chỉ tạo giao dịch nếu hóa đơn có điểm tích lũy
        if (totalPoint > 0) {
            pointTransactionId = randomUUID();

            await new sql.Request(transaction)
                .input(
                    "transactionId",
                    sql.VarChar(36),
                    pointTransactionId
                )
                .input("customerId", sql.VarChar(36), invoice.customerId)
                .input("invoiceId", sql.VarChar(36), invoiceId)
                .input("point", sql.Int, totalPoint)
                .query(`
                    INSERT INTO PointTransactions (
                        transactionId,
                        customerId,
                        invoiceId,
                        redemptionId,
                        type,
                        point,
                        txHash,
                        status
                    )
                    VALUES (
                        @transactionId,
                        @customerId,
                        @invoiceId,
                        NULL,
                        'EARN',
                        @point,
                        NULL,
                        'PENDING'
                    )
                `);
        }

        await transaction.commit();

        return {
            invoiceId,
            paymentStatus: "PAID",
            totalAmount: Number(invoice.totalAmount),
            basePoint,
            bonusPoint,
            totalPoint,
            pointTransactionId,
            blockchainStatus: totalPoint > 0 ? "PENDING" : null
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {}

        throw error;
    }
}

// Hủy hóa đơn chưa thanh toán
async function cancelInvoice(invoiceId) {
    const pool = await poolPromise;

    const result = await pool.request()
        .input("invoiceId", sql.VarChar(36), invoiceId)
        .query(`
            UPDATE Invoices
            SET paymentStatus = 'CANCELLED'
            WHERE invoiceId = @invoiceId
              AND paymentStatus = 'UNPAID';

            SELECT @@ROWCOUNT AS affectedRows;
        `);

    if (result.recordset[0].affectedRows === 0) {
        const invoice = await findInvoiceById(invoiceId);

        if (!invoice) {
            const error = new Error("Không tìm thấy hóa đơn");
            error.statusCode = 404;
            error.code = "INVOICE_NOT_FOUND";
            throw error;
        }

        const error = new Error(
            "Chỉ được hủy hóa đơn chưa thanh toán"
        );
        error.statusCode = 409;
        error.code = "INVOICE_CANNOT_BE_CANCELLED";
        throw error;
    }

    return await findInvoiceById(invoiceId);
}

// Xem chi tiết hóa đơn
async function findInvoiceById(invoiceId) {
    const pool = await poolPromise;

    const invoiceResult = await pool.request()
        .input("invoiceId", sql.VarChar(36), invoiceId)
        .query(`
            SELECT
                i.*,
                c.userId AS customerUserId,
                u.fullName AS customerName,
                s.employeeCode
            FROM Invoices i
            INNER JOIN Customers c ON i.customerId = c.userId
            INNER JOIN Users u ON c.userId = u.userId
            INNER JOIN Staffs s ON i.staffId = s.userId
            WHERE i.invoiceId = @invoiceId
        `);

    if (invoiceResult.recordset.length === 0) {
        return null;
    }

    const detailResult = await pool.request()
        .input("invoiceId", sql.VarChar(36), invoiceId)
        .query(`
            SELECT
                d.invoiceDetailId,
                d.productId,
                p.productName,
                d.quantity,
                d.unitPrice,
                d.discount,
                (d.quantity * d.unitPrice - d.discount) AS lineTotal
            FROM InvoiceDetails d
            INNER JOIN Products p ON d.productId = p.productId
            WHERE d.invoiceId = @invoiceId
        `);

    return {
        ...invoiceResult.recordset[0],
        details: detailResult.recordset
    };
}

// Danh sách hóa đơn
async function findAllInvoices(filters) {
    const pool = await poolPromise;
    const request = pool.request();

    let query = `
        SELECT
            i.invoiceId,
            i.customerId,
            u.fullName AS customerName,
            i.staffId,
            i.ruleId,
            i.invoiceDate,
            i.totalAmount,
            i.totalPoint,
            i.paymentStatus
        FROM Invoices i
        INNER JOIN Customers c ON i.customerId = c.userId
        INNER JOIN Users u ON c.userId = u.userId
        WHERE 1 = 1
    `;

    if (filters.status) {
        query += ` AND i.paymentStatus = @status`;
        request.input("status", sql.VarChar(20), filters.status);
    }

    if (filters.customerId) {
        query += ` AND i.customerId = @customerId`;
        request.input("customerId", sql.VarChar(36), filters.customerId);
    }

    if (filters.fromDate) {
        query += ` AND i.invoiceDate >= @fromDate`;
        request.input("fromDate", sql.DateTime, new Date(filters.fromDate));
    }

    if (filters.toDate) {
        query += ` AND i.invoiceDate < DATEADD(DAY, 1, @toDate)`;
        request.input("toDate", sql.DateTime, new Date(filters.toDate));
    }

    query += ` ORDER BY i.invoiceDate DESC`;

    const result = await request.query(query);
    return result.recordset;
}

module.exports = {
    createInvoice,
    payInvoice,
    cancelInvoice,
    findInvoiceById,
    findAllInvoices
};
