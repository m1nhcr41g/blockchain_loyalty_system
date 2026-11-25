const crypto = require("crypto");
const { sql, poolPromise } = require("../config/db");

function createError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

// Tạo yêu cầu đổi quà
async function createRedemption(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
        // Khóa khách hàng để tránh nhiều yêu cầu đổi điểm đồng thời
        const customerResult = await new sql.Request(transaction)
            .input("customerId", sql.VarChar(36), data.customerId)
            .query(`
                SELECT userId, totalPoint
                FROM Customers WITH (UPDLOCK, HOLDLOCK)
                WHERE userId = @customerId
            `);

        if (customerResult.recordset.length === 0) {
            throw createError("Khách hàng không tồn tại", "CUSTOMER_NOT_FOUND");
        }

        const customer = customerResult.recordset[0];

        // Khóa phần quà để tránh nhiều khách cùng đổi phần quà cuối cùng
        const rewardResult = await new sql.Request(transaction)
            .input("rewardId", sql.VarChar(36), data.rewardId)
            .query(`
                SELECT rewardId, rewardName, requiredPoint, quantity, status
                FROM Rewards WITH (UPDLOCK, HOLDLOCK)
                WHERE rewardId = @rewardId
            `);

        if (rewardResult.recordset.length === 0) {
            throw createError("Không tìm thấy phần quà", "REWARD_NOT_FOUND");
        }

        const reward = rewardResult.recordset[0];

        if (reward.status !== "ACTIVE") {
            throw createError("Phần quà hiện không hoạt động", "REWARD_NOT_ACTIVE");
        }

        // Tính số điểm đang được giữ cho các yêu cầu chờ Blockchain
        const pendingPointResult = await new sql.Request(transaction)
            .input("customerId", sql.VarChar(36), data.customerId)
            .query(`
                SELECT COALESCE(SUM(pt.point), 0) AS pendingPoint
                FROM PointTransactions pt
                WHERE pt.customerId = @customerId
                  AND pt.type = 'REDEEM'
                  AND pt.status = 'PENDING'
            `);

        const pendingPoint = Number(
            pendingPointResult.recordset[0].pendingPoint
        );

        const availablePoint =
            Number(customer.totalPoint) - pendingPoint;

        if (availablePoint < Number(reward.requiredPoint)) {
            throw createError(
                "Không đủ điểm để đổi quà",
                "NOT_ENOUGH_POINT"
            );
        }

        // Tính số lượng quà đang được giữ cho các yêu cầu chờ Blockchain
        const pendingRewardResult = await new sql.Request(transaction)
            .input("rewardId", sql.VarChar(36), data.rewardId)
            .query(`
                SELECT COUNT(*) AS pendingQuantity
                FROM RewardRedemptions rr
                INNER JOIN PointTransactions pt
                    ON pt.redemptionId = rr.redemptionId
                WHERE rr.rewardId = @rewardId
                  AND rr.status = 'PENDING'
                  AND pt.type = 'REDEEM'
                  AND pt.status = 'PENDING'
            `);

        const pendingQuantity = Number(
            pendingRewardResult.recordset[0].pendingQuantity
        );

        const availableQuantity =
            Number(reward.quantity) - pendingQuantity;

        if (availableQuantity <= 0) {
            throw createError(
                "Phần quà đã hết hoặc đang được giữ cho yêu cầu khác",
                "REWARD_OUT_OF_STOCK"
            );
        }

        const redemptionId = crypto.randomUUID();
        const transactionId = crypto.randomUUID();

        const redemptionCode =
            "RD" + crypto.randomBytes(8).toString("hex").toUpperCase();

        const pointUsed = Number(reward.requiredPoint);

        // Tạo phiếu đổi quà
        await new sql.Request(transaction)
            .input("redemptionId", sql.VarChar(36), redemptionId)
            .input("customerId", sql.VarChar(36), data.customerId)
            .input("rewardId", sql.VarChar(36), data.rewardId)
            .input("pointUsed", sql.Int, pointUsed)
            .input("redemptionCode", sql.VarChar(50), redemptionCode)
            .query(`
                INSERT INTO RewardRedemptions (
                    redemptionId,
                    customerId,
                    rewardId,
                    staffId,
                    pointUsed,
                    redemptionCode,
                    status
                )
                VALUES (
                    @redemptionId,
                    @customerId,
                    @rewardId,
                    NULL,
                    @pointUsed,
                    @redemptionCode,
                    'PENDING'
                )
            `);

        // Tạo giao dịch REDEEM chờ Blockchain
        await new sql.Request(transaction)
            .input("transactionId", sql.VarChar(36), transactionId)
            .input("customerId", sql.VarChar(36), data.customerId)
            .input("redemptionId", sql.VarChar(36), redemptionId)
            .input("point", sql.Int, pointUsed)
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
                    NULL,
                    @redemptionId,
                    'REDEEM',
                    @point,
                    NULL,
                    'PENDING'
                )
            `);

        await transaction.commit();

        return await findRedemptionById(redemptionId);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

// Lấy thông tin một phiếu đổi quà
async function findRedemptionById(redemptionId) {
    const pool = await poolPromise;

    const result = await pool.request()
        .input("redemptionId", sql.VarChar(36), redemptionId)
        .query(`
            SELECT
                rr.redemptionId,
                rr.customerId,
                customer.fullName AS customerName,
                rr.rewardId,
                r.rewardName,
                r.imageUrl,
                r.requiredPoint,
                rr.staffId,
                rr.redeemDate,
                rr.pointUsed,
                rr.redemptionCode,
                rr.status,
                pt.status AS transactionStatus
            FROM RewardRedemptions rr
            INNER JOIN Users customer
                ON customer.userId = rr.customerId
            INNER JOIN Rewards r
                ON r.rewardId = rr.rewardId
            LEFT JOIN PointTransactions pt
                ON pt.redemptionId = rr.redemptionId
               AND pt.type = 'REDEEM'
            WHERE rr.redemptionId = @redemptionId
        `);

    return result.recordset[0] || null;
}

// Lịch sử đổi quà của khách hàng
async function findRedemptionsByCustomer(customerId) {
    const pool = await poolPromise;

    const result = await pool.request()
        .input("customerId", sql.VarChar(36), customerId)
        .query(`
            SELECT
                rr.redemptionId,
                rr.rewardId,
                r.rewardName,
                r.imageUrl,
                rr.redeemDate,
                rr.pointUsed,
                rr.redemptionCode,
                rr.status
            FROM RewardRedemptions rr
            INNER JOIN Rewards r
                ON r.rewardId = rr.rewardId
            WHERE rr.customerId = @customerId
            ORDER BY rr.redeemDate DESC
        `);

    return result.recordset;
}

// Nhân viên tra cứu phiếu bằng redemptionCode
async function findRedemptionByCode(redemptionCode) {
    const pool = await poolPromise;

    const result = await pool.request()
        .input("redemptionCode", sql.VarChar(50), redemptionCode)
        .query(`
            SELECT
                rr.redemptionId,
                rr.customerId,
                customer.fullName AS customerName,
                rr.rewardId,
                r.rewardName,
                rr.redeemDate,
                rr.pointUsed,
                rr.redemptionCode,
                rr.status,
                pt.status AS transactionStatus
            FROM RewardRedemptions rr
            INNER JOIN Users customer
                ON customer.userId = rr.customerId
            INNER JOIN Rewards r
                ON r.rewardId = rr.rewardId
            LEFT JOIN PointTransactions pt
                ON pt.redemptionId = rr.redemptionId
               AND pt.type = 'REDEEM'
            WHERE rr.redemptionCode = @redemptionCode
        `);

    return result.recordset[0] || null;
}

// Nhân viên xác nhận giao quà
async function deliverRedemption(redemptionId, staffId) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
        const redemptionResult = await new sql.Request(transaction)
            .input("redemptionId", sql.VarChar(36), redemptionId)
            .query(`
                SELECT
                    rr.redemptionId,
                    rr.status,
                    pt.status AS transactionStatus
                FROM RewardRedemptions rr WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN PointTransactions pt
                    ON pt.redemptionId = rr.redemptionId
                   AND pt.type = 'REDEEM'
                WHERE rr.redemptionId = @redemptionId
            `);

        if (redemptionResult.recordset.length === 0) {
            throw createError(
                "Không tìm thấy phiếu đổi quà",
                "REDEMPTION_NOT_FOUND"
            );
        }

        const redemption = redemptionResult.recordset[0];

        if (redemption.status !== "PENDING") {
            throw createError(
                "Phiếu đổi quà không ở trạng thái chờ giao",
                "REDEMPTION_NOT_PENDING"
            );
        }

        if (redemption.transactionStatus !== "SUCCESS") {
            throw createError(
                "Giao dịch Blockchain chưa xác nhận thành công",
                "BLOCKCHAIN_TRANSACTION_NOT_CONFIRMED"
            );
        }

        const staffResult = await new sql.Request(transaction)
            .input("staffId", sql.VarChar(36), staffId)
            .query(`
                SELECT userId
                FROM Staffs
                WHERE userId = @staffId
            `);

        if (staffResult.recordset.length === 0) {
            throw createError("Nhân viên không tồn tại", "STAFF_NOT_FOUND");
        }

        await new sql.Request(transaction)
            .input("redemptionId", sql.VarChar(36), redemptionId)
            .input("staffId", sql.VarChar(36), staffId)
            .query(`
                UPDATE RewardRedemptions
                SET status = 'DELIVERED',
                    staffId = @staffId
                WHERE redemptionId = @redemptionId
                  AND status = 'PENDING'
            `);

        await transaction.commit();

        return await findRedemptionById(redemptionId);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    createRedemption,
    findRedemptionById,
    findRedemptionsByCustomer,
    findRedemptionByCode,
    deliverRedemption
};
