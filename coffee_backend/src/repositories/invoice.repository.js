const crypto = require("crypto");
const { sql, poolPromise } = require("../config/db");

function createError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

// Lấy chi tiết hóa đơn
async function findInvoiceById(invoiceId) {
    const pool = await poolPromise;

    const invoiceResult = await pool.request()
        .input("invoiceId", sql.VarChar(36), invoiceId)
        .query(`
            SELECT
                i.invoiceId,
                i.customerId,
                customer.fullName AS customerName,
                i.staffId,
                staff.fullName AS staffName,
                i.ruleId,
                i.invoiceDate,
                i.totalAmount,
                i.totalPoint,
                i.paymentStatus
            FROM Invoices i
            INNER JOIN Users customer ON customer.userId = i.customerId
            INNER JOIN Users staff ON staff.userId = i.staffId
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
            INNER JOIN Products p ON p.productId = d.productId
            WHERE d.invoiceId = @invoiceId
        `);

    return {
        ...invoiceResult.recordset[0],
        details: detailResult.recordset
    };
}

// Tạo hóa đơn mới
async function createInvoice(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
        const customerResult = await new sql.Request(transaction)
            .input("customerId", sql.VarChar(36), data.customerId)
            .query(`
                SELECT userId
                FROM Customers WITH (UPDLOCK, HOLDLOCK)
                WHERE userId = @customerId
            `);

        if (customerResult.recordset.length === 0) {
            throw createError("Khách hàng không tồn tại", "CUSTOMER_NOT_FOUND");
        }

        const staffResult = await new sql.Request(transaction)
            .input("staffId", sql.VarChar(36), data.staffId)
            .query(`
                SELECT userId
                FROM Staffs
                WHERE userId = @staffId
            `);

        if (staffResult.recordset.length === 0) {
            throw createError("Nhân viên không tồn tại", "STAFF_NOT_FOUND");
        }

        // Lấy PointRule đang có hiệu lực để lưu cố định vào hóa đơn
        const ruleResult = await new sql.Request(transaction).query(`
            SELECT TOP 1 ruleId
            FROM PointRules
            WHERE status = 'ACTIVE'
              AND startDate <= GETDATE()
              AND (endDate IS NULL OR endDate >= GETDATE())
            ORDER BY startDate DESC
        `);

        if (ruleResult.recordset.length === 0) {
            throw createError("Hiện không có quy tắc tích điểm đang áp dụng","POINT_RULE_NOT_FOUND");
        }

        const ruleId = ruleResult.recordset[0].ruleId;
        const invoiceId = crypto.randomUUID();

        let totalAmountCents = 0;
        const invoiceDetails = [];
        for (const item of data.items) {
            const productResult = await new sql.Request(transaction)
                .input("productId", sql.VarChar(36), item.productId)
                .query(`
                    SELECT productId, productName, price
                    FROM Products
                    WHERE productId = @productId
                      AND status = 'ACTIVE'
                `);
            if (productResult.recordset.length === 0) {
                throw createError(`Sản phẩm ${item.productId} không tồn tại hoặc không hoạt động`,"PRODUCT_NOT_AVAILABLE");
            }

            const product = productResult.recordset[0];
            const unitPrice = Number(product.price);
            const quantity = item.quantity;

            // Quy đổi sang số nguyên cent để hạn chế sai số số thực
            const unitPriceCents = Math.round(unitPrice * 100);
            const lineTotalCents = unitPriceCents * quantity;
            totalAmountCents += lineTotalCents;
            invoiceDetails.push({
                invoiceDetailId: crypto.randomUUID(),
                productId: product.productId,
                productName: product.productName,
                quantity,
                unitPrice,
                discount: 0
            });
        }
        const totalAmount = totalAmountCents / 100;
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

        for (const detail of invoiceDetails) {
            await new sql.Request(transaction)
                .input("invoiceDetailId", sql.VarChar(36), detail.invoiceDetailId)
                .input("invoiceId", sql.VarChar(36), invoiceId)
                .input("productId", sql.VarChar(36), detail.productId)
                .input("quantity", sql.Int, detail.quantity)
                .input("unitPrice", sql.Decimal(18, 2), detail.unitPrice)
                .input("discount", sql.Decimal(18, 2), 0)
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
        await transaction.rollback();
        throw error;
    }
}

// Xác nhận thanh toán hóa đơn và tạo giao dịch tích điểm
async function payInvoice(invoiceId) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const invoiceResult = await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .query(`
                SELECT
                    i.invoiceId,
                    i.customerId,
                    i.ruleId,
                    i.totalAmount,
                    i.paymentStatus,
                    r.pointRate,
                    r.minimumAmount
                FROM Invoices i WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN PointRules r ON r.ruleId = i.ruleId
                WHERE i.invoiceId = @invoiceId
            `);

        if (invoiceResult.recordset.length === 0) {
            throw createError("Không tìm thấy hóa đơn", "INVOICE_NOT_FOUND");
        }
        const invoice = invoiceResult.recordset[0];
        if (invoice.paymentStatus !== "UNPAID") {
            throw createError("Chỉ có thể thanh toán hóa đơn chưa thanh toán", "INVOICE_NOT_UNPAID");
        }

        const totalAmount = Number(invoice.totalAmount);
        const pointRate = Number(invoice.pointRate);
        const minimumAmount = Number(invoice.minimumAmount);

        let basePoint = 0;
        if (totalAmount >= minimumAmount) {
            basePoint = Math.floor(totalAmount / pointRate);
        }

        const promotionResult = await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .query(`
                SELECT
                    COALESCE(SUM(p.bonusPoint * d.quantity), 0) AS bonusPoint
                FROM InvoiceDetails d
                INNER JOIN Promotions p ON p.productId = d.productId
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
        await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .input("totalPoint", sql.Int, totalPoint)
            .query(`
                UPDATE Invoices
                SET paymentStatus = 'PAID',
                    totalPoint = @totalPoint
                WHERE invoiceId = @invoiceId
                  AND paymentStatus = 'UNPAID'
            `);

        let pendingTransactionId = null;
        if (totalPoint > 0) {
            pendingTransactionId = crypto.randomUUID();
            await new sql.Request(transaction)
                .input("transactionId", sql.VarChar(36), pendingTransactionId)
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
        const paidInvoice = await findInvoiceById(invoiceId);
        return {
            ...paidInvoice,
            pendingTransactionId
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

// Hủy hóa đơn chưa thanh toán
async function cancelInvoice(invoiceId) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
        const result = await new sql.Request(transaction)
            .input("invoiceId", sql.VarChar(36), invoiceId)
            .query(`
                UPDATE Invoices
                SET paymentStatus = 'CANCELLED'
                WHERE invoiceId = @invoiceId
                  AND paymentStatus = 'UNPAID';

                SELECT @@ROWCOUNT AS affectedRows;
            `);

        if (result.recordset[0].affectedRows === 0) {
            const exists = await new sql.Request(transaction)
                .input("invoiceId", sql.VarChar(36), invoiceId)
                .query(`
                    SELECT invoiceId, paymentStatus
                    FROM Invoices
                    WHERE invoiceId = @invoiceId
                `);
            if (exists.recordset.length === 0) {
                throw createError("Không tìm thấy hóa đơn", "INVOICE_NOT_FOUND");
            }
            throw createError("Chỉ có thể hủy hóa đơn chưa thanh toán","INVOICE_CANNOT_BE_CANCELLED");
        }
        await transaction.commit();
        return await findInvoiceById(invoiceId);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

// Lấy danh sách hóa đơn
async function findAllInvoices(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();

    let query = `
        SELECT
            i.invoiceId,
            i.customerId,
            customer.fullName AS customerName,
            i.staffId,
            staff.fullName AS staffName,
            i.ruleId,
            i.invoiceDate,
            i.totalAmount,
            i.totalPoint,
            i.paymentStatus
        FROM Invoices i
        INNER JOIN Users customer ON customer.userId = i.customerId
        INNER JOIN Users staff ON staff.userId = i.staffId
        WHERE 1 = 1
    `;

    if (filters.paymentStatus) {
        query += " AND i.paymentStatus = @paymentStatus";
        request.input("paymentStatus", sql.VarChar(20), filters.paymentStatus);
    }
    if (filters.customerId) {
        query += " AND i.customerId = @customerId";
        request.input("customerId", sql.VarChar(36), filters.customerId);
    }
    if (filters.fromDate) {
        query += " AND i.invoiceDate >= @fromDate";
        request.input("fromDate", sql.DateTime, new Date(filters.fromDate));
    }
    if (filters.toDate) {
        query += " AND i.invoiceDate < DATEADD(DAY, 1, @toDate)";
        request.input("toDate", sql.DateTime, new Date(filters.toDate));
    }
    query += " ORDER BY i.invoiceDate DESC";
    const result = await request.query(query);
    return result.recordset;
}

module.exports = {
    findInvoiceById,
    createInvoice,
    payInvoice,
    cancelInvoice,
    findAllInvoices
};
