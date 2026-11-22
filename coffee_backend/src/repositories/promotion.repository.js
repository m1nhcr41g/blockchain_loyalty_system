const { sql, poolPromise } = require("../config/db");

// Lấy danh sách chương trình khuyến mãi
async function getAll(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    let query = `
        SELECT
            p.promotionId,
            p.productId,
            pr.productName,
            p.promotionName,
            p.promotionType,
            p.bonusPoint,
            p.startDate,
            p.endDate,
            p.status
        FROM Promotions p
        INNER JOIN Products pr
            ON p.productId = pr.productId
        WHERE 1 = 1
    `;

    if (filters.status) {
        query += ` AND p.status = @status`;
        request.input("status", sql.VarChar(20), filters.status);
    }
    if (filters.productId) {
        query += ` AND p.productId = @productId`;
        request.input("productId", sql.VarChar(36), filters.productId);
    }
    query += ` ORDER BY p.startDate DESC`;
    const result = await request.query(query);
    return result.recordset;
}

// Lấy chương trình khuyến mãi theo ID
async function getById(promotionId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("promotionId", sql.VarChar(36), promotionId)
        .query(`
            SELECT
                p.promotionId,
                p.productId,
                pr.productName,
                p.promotionName,
                p.promotionType,
                p.bonusPoint,
                p.startDate,
                p.endDate,
                p.status
            FROM Promotions p
            INNER JOIN Products pr
                ON p.productId = pr.productId
            WHERE p.promotionId = @promotionId
        `);

    return result.recordset[0] || null;
}

// Kiểm tra sản phẩm có tồn tại không
async function productExists(productId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("productId", sql.VarChar(36), productId)
        .query(`
            SELECT productId
            FROM Products
            WHERE productId = @productId
        `);
    return result.recordset.length > 0;
}

// Tạo chương trình khuyến mãi
async function create(data) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("promotionId", sql.VarChar(36), data.promotionId)
        .input("productId", sql.VarChar(36), data.productId)
        .input("promotionName", sql.NVarChar(150), data.promotionName)
        .input("promotionType", sql.VarChar(30), data.promotionType)
        .input("bonusPoint", sql.Int, data.bonusPoint)
        .input("startDate", sql.DateTime, data.startDate)
        .input("endDate", sql.DateTime, data.endDate)
        .input("status", sql.VarChar(20), data.status)
        .query(`
            INSERT INTO Promotions (
                promotionId,
                productId,
                promotionName,
                promotionType,
                bonusPoint,
                startDate,
                endDate,
                status
            )
            OUTPUT INSERTED.*
            VALUES (
                @promotionId,
                @productId,
                @promotionName,
                @promotionType,
                @bonusPoint,
                @startDate,
                @endDate,
                @status
            )
        `);

    return result.recordset[0];
}

// Cập nhật chương trình khuyến mãi
async function update(promotionId, data) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("promotionId", sql.VarChar(36), promotionId)
        .input("productId", sql.VarChar(36), data.productId)
        .input("promotionName", sql.NVarChar(150), data.promotionName)
        .input("promotionType", sql.VarChar(30), data.promotionType)
        .input("bonusPoint", sql.Int, data.bonusPoint)
        .input("startDate", sql.DateTime, data.startDate)
        .input("endDate", sql.DateTime, data.endDate)
        .query(`
            UPDATE Promotions
            SET
                productId = @productId,
                promotionName = @promotionName,
                promotionType = @promotionType,
                bonusPoint = @bonusPoint,
                startDate = @startDate,
                endDate = @endDate
            WHERE promotionId = @promotionId;

            SELECT *
            FROM Promotions
            WHERE promotionId = @promotionId;
        `);

    return result.recordset[0] || null;
}

// Cập nhật trạng thái chương trình khuyến mãi
async function updateStatus(promotionId, status) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("promotionId", sql.VarChar(36), promotionId)
        .input("status", sql.VarChar(20), status)
        .query(`
            UPDATE Promotions
            SET status = @status
            WHERE promotionId = @promotionId;

            SELECT *
            FROM Promotions
            WHERE promotionId = @promotionId;
        `);
    return result.recordset[0] || null;
}

module.exports = {
    getAll,
    getById,
    productExists,
    create,
    update,
    updateStatus
};
