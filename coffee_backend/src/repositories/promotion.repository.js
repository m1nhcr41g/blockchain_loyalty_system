const { sql, poolPromise } = require('../config/db');

// Kiểm tra sản phẩm có tồn tại không
const findProductById = async (productId) => {
    const pool = await poolPromise;

    const result = await pool.request()
        .input('productId', sql.VarChar(36), productId)
        .query(`
            SELECT
                productId,
                productName,
                imageUrl AS productImageUrl,
                status
            FROM Products
            WHERE productId = @productId
        `);

    return result.recordset[0] || null;
};

// Kiểm tra trùng thời gian khuyến mãi
const findOverlappingPromotion = async (
    productId,
    startDate,
    endDate,
    excludePromotionId = null
) => {
    const pool = await poolPromise;

    const request = pool.request()
        .input('productId', sql.VarChar(36), productId)
        .input('startDate', sql.DateTime, startDate)
        .input('endDate', sql.DateTime, endDate);

    let query = `
        SELECT
            promotionId,
            promotionName
        FROM Promotions
        WHERE productId = @productId
          AND status = 'ACTIVE'
          AND startDate <= @endDate
          AND endDate >= @startDate
    `;

    if (excludePromotionId) {
        query += ` AND promotionId <> @excludePromotionId`;
        request.input('excludePromotionId', sql.VarChar(36), excludePromotionId);
    }

    const result = await request.query(query);
    return result.recordset[0] || null;
};

// Tạo chương trình khuyến mãi (Đã chuẩn cú pháp SQL Server)
const create = async (promotionData) => {
    const pool = await poolPromise;

    await pool.request()
        .input('promotionId', sql.VarChar(36), promotionData.promotionId)
        .input('productId', sql.VarChar(36), promotionData.productId)
        .input('promotionName', sql.NVarChar(150), promotionData.promotionName)
        .input('promotionType', sql.VarChar(30), promotionData.promotionType)
        .input('bonusPoint', sql.Int, promotionData.bonusPoint)
        .input('startDate', sql.DateTime, promotionData.startDate)
        .input('endDate', sql.DateTime, promotionData.endDate)
        .input('status', sql.VarChar(20), promotionData.status)
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

    return promotionData;
};

// Danh sách khuyến mãi đang áp dụng (Public)
const findPublicList = async ({ offset, limit, search, productId }) => {
    const pool = await poolPromise;
    const request = pool.request();

    let whereClause = `
        WHERE pr.status = 'ACTIVE'
          AND p.status = 'ACTIVE'
          AND GETDATE() BETWEEN pr.startDate AND pr.endDate
    `;

    if (search) {
        whereClause += ` AND (pr.promotionName LIKE @search OR p.productName LIKE @search)`;
        request.input('search', sql.NVarChar(150), `%${search}%`);
    }

    if (productId) {
        whereClause += ` AND pr.productId = @productId`;
        request.input('productId', sql.VarChar(36), productId);
    }

    const countResult = await request.query(`
        SELECT COUNT(*) AS total
        FROM Promotions pr
        INNER JOIN Products p ON pr.productId = p.productId
        ${whereClause}
    `);

    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const dataResult = await request.query(`
        SELECT
            pr.promotionId,
            pr.productId,
            p.productName,
            p.category AS productCategory,
            p.price AS productPrice,
            p.imageUrl AS productImageUrl,
            pr.promotionName,
            pr.promotionType,
            pr.bonusPoint,
            pr.startDate,
            pr.endDate,
            pr.status
        FROM Promotions pr
        INNER JOIN Products p ON pr.productId = p.productId
        ${whereClause}
        ORDER BY pr.endDate ASC, pr.bonusPoint DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return {
        items: dataResult.recordset,
        total: countResult.recordset[0].total
    };
};

// Chi tiết khuyến mãi (Public)
const findPublicById = async (promotionId) => {
    const pool = await poolPromise;

    const result = await pool.request()
        .input('promotionId', sql.VarChar(36), promotionId)
        .query(`
            SELECT
                pr.promotionId,
                pr.productId,
                p.productName,
                p.category AS productCategory,
                p.price AS productPrice,
                p.imageUrl AS productImageUrl,
                pr.promotionName,
                pr.promotionType,
                pr.bonusPoint,
                pr.startDate,
                pr.endDate,
                pr.status
            FROM Promotions pr
            INNER JOIN Products p ON pr.productId = p.productId
            WHERE pr.promotionId = @promotionId
              AND pr.status = 'ACTIVE'
              AND p.status = 'ACTIVE'
              AND GETDATE() BETWEEN pr.startDate AND pr.endDate
        `);

    return result.recordset[0] || null;
};

// Danh sách khuyến mãi (Admin)
const findAdminList = async ({ offset, limit, search, status, productId }) => {
    const pool = await poolPromise;
    const request = pool.request();

    let whereClause = 'WHERE 1 = 1';

    if (status) {
        whereClause += ' AND pr.status = @status';
        request.input('status', sql.VarChar(20), status);
    }

    if (productId) {
        whereClause += ' AND pr.productId = @productId';
        request.input('productId', sql.VarChar(36), productId);
    }

    if (search) {
        whereClause += ` AND (pr.promotionName LIKE @search OR p.productName LIKE @search OR pr.promotionType LIKE @search)`;
        request.input('search', sql.NVarChar(150), `%${search}%`);
    }

    const countResult = await request.query(`
        SELECT COUNT(*) AS total
        FROM Promotions pr
        INNER JOIN Products p ON pr.productId = p.productId
        ${whereClause}
    `);

    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const dataResult = await request.query(`
        SELECT
            pr.promotionId,
            pr.productId,
            p.productName,
            p.category AS productCategory,
            p.price AS productPrice,
            p.imageUrl AS productImageUrl,
            pr.promotionName,
            pr.promotionType,
            pr.bonusPoint,
            pr.startDate,
            pr.endDate,
            pr.status,
            CASE
                WHEN pr.status = 'INACTIVE' THEN 'INACTIVE'
                WHEN GETDATE() < pr.startDate THEN 'UPCOMING'
                WHEN GETDATE() > pr.endDate THEN 'EXPIRED'
                ELSE 'ONGOING'
            END AS effectiveState
        FROM Promotions pr
        INNER JOIN Products p ON pr.productId = p.productId
        ${whereClause}
        ORDER BY pr.startDate DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return {
        items: dataResult.recordset,
        total: countResult.recordset[0].total
    };
};

// Chi tiết khuyến mãi (Admin)
const findAdminById = async (promotionId) => {
    const pool = await poolPromise;

    const result = await pool.request()
        .input('promotionId', sql.VarChar(36), promotionId)
        .query(`
            SELECT
                pr.promotionId,
                pr.productId,
                p.productName,
                p.category AS productCategory,
                p.price AS productPrice,
                p.imageUrl AS productImageUrl,
                pr.promotionName,
                pr.promotionType,
                pr.bonusPoint,
                pr.startDate,
                pr.endDate,
                pr.status
            FROM Promotions pr
            INNER JOIN Products p ON pr.productId = p.productId
            WHERE pr.promotionId = @promotionId
        `);

    return result.recordset[0] || null;
};

// Lấy dữ liệu gốc
const findRawById = async (promotionId) => {
    const pool = await poolPromise;

    const result = await pool.request()
        .input('promotionId', sql.VarChar(36), promotionId)
        .query('SELECT * FROM Promotions WHERE promotionId = @promotionId');

    return result.recordset[0] || null;
};

// Cập nhật khuyến mãi
const update = async (promotionId, updateData) => {
    const pool = await poolPromise;

    await pool.request()
        .input('promotionId', sql.VarChar(36), promotionId)
        .input('productId', sql.VarChar(36), updateData.productId)
        .input('promotionName', sql.NVarChar(150), updateData.promotionName)
        .input('promotionType', sql.VarChar(30), updateData.promotionType)
        .input('bonusPoint', sql.Int, updateData.bonusPoint)
        .input('startDate', sql.DateTime, updateData.startDate)
        .input('endDate', sql.DateTime, updateData.endDate)
        .query(`
            UPDATE Promotions
            SET productId = @productId,
                promotionName = @promotionName,
                promotionType = @promotionType,
                bonusPoint = @bonusPoint,
                startDate = @startDate,
                endDate = @endDate
            WHERE promotionId = @promotionId
        `);

    return await findRawById(promotionId);
};

// Cập nhật trạng thái
const updateStatus = async (promotionId, status) => {
    const pool = await poolPromise;

    await pool.request()
        .input('promotionId', sql.VarChar(36), promotionId)
        .input('status', sql.VarChar(20), status)
        .query('UPDATE Promotions SET status = @status WHERE promotionId = @promotionId');

    return await findRawById(promotionId);
};

module.exports = {
    findProductById,
    findOverlappingPromotion,
    create,
    findPublicList,
    findPublicById,
    findAdminList,
    findAdminById,
    findRawById,
    update,
    updateStatus
};