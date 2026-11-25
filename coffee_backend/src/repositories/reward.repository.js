const { sql, poolPromise } = require('../config/db');

const findPublicList = async ({ page = 1, limit = 10, search = '', inStockOnly = false }) => {
    pool = await poolPromise;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE status = 'ACTIVE'`;
    if (search) {
        whereClause += ` AND (rewardName LIKE @search OR description LIKE @search)`;
    }
    if (inStockOnly) {
        whereClause += ` AND quantity > 0`;
    }

    const countRequest = pool.request();
    if (search) countRequest.input('search', sql.NVarChar, `%${search}%`);
    const countResult = await countRequest.query(`
        SELECT COUNT(*) AS total FROM Rewards ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    const listRequest = pool.request()
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limit);
    if (search) listRequest.input('search', sql.NVarChar, `%${search}%`);

    const listResult = await listRequest.query(`
        SELECT rewardId, rewardName, description, imageUrl, requiredPoint, quantity, status
        FROM Rewards
        ${whereClause}
        ORDER BY requiredPoint ASC, rewardName ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return { items: listResult.recordset, total };
};

const findPublicById = async (rewardId) => {
    pool = await poolPromise;
    const result = await pool.request()
        .input('rewardId', sql.VarChar(36), rewardId)
        .query(`
            SELECT rewardId, rewardName, description, imageUrl, requiredPoint, quantity, status
            FROM Rewards
            WHERE rewardId = @rewardId AND status = 'ACTIVE'
        `);
    return result.recordset[0] || null;
};

const findAdminList = async ({ page = 1, limit = 10, search = '', status = '' }) => {
    pool = await poolPromise;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE 1 = 1`;
    if (search) {
        whereClause += ` AND (rewardName LIKE @search OR description LIKE @search)`;
    }
    if (status) {
        whereClause += ` AND status = @status`;
    }

    const countRequest = pool.request();
    if (search) countRequest.input('search', sql.NVarChar, `%${search}%`);
    if (status) countRequest.input('status', sql.VarChar(20), status);
    const countResult = await countRequest.query(`
        SELECT COUNT(*) AS total FROM Rewards ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    const listRequest = pool.request()
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limit);
    if (search) listRequest.input('search', sql.NVarChar, `%${search}%`);
    if (status) listRequest.input('status', sql.VarChar(20), status);

    const listResult = await listRequest.query(`
        SELECT rewardId, rewardName, description, imageUrl, requiredPoint, quantity, status
        FROM Rewards
        ${whereClause}
        ORDER BY rewardName ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return { items: listResult.recordset, total };
};

const findById = async (rewardId) => {
    pool = await poolPromise;
    const result = await pool.request()
        .input('rewardId', sql.VarChar(36), rewardId)
        .query(`
            SELECT rewardId, rewardName, description, imageUrl, requiredPoint, quantity, status
            FROM Rewards
            WHERE rewardId = @rewardId
        `);
    return result.recordset[0] || null;
};

const create = async (data) => {
    pool = await poolPromise;
    await pool.request()
        .input('rewardId', sql.VarChar(36), data.rewardId)
        .input('rewardName', sql.NVarChar(100), data.rewardName)
        .input('description', sql.NVarChar(255), data.description || null)
        .input('imageUrl', sql.VarChar(255), data.imageUrl || null)
        .input('requiredPoint', sql.Int, data.requiredPoint)
        .input('quantity', sql.Int, data.quantity)
        .input('status', sql.VarChar(20), data.status || 'ACTIVE')
        .query(`
            INSERT INTO Rewards (rewardId, rewardName, description, imageUrl, requiredPoint, quantity, status)
            VALUES (@rewardId, @rewardName, @description, @imageUrl, @requiredPoint, @quantity, @status)
        `);
    return findById(data.rewardId);
};

const update = async (rewardId, data) => {
    pool = await poolPromise;
    await pool.request()
        .input('rewardId', sql.VarChar(36), rewardId)
        .input('rewardName', sql.NVarChar(100), data.rewardName)
        .input('description', sql.NVarChar(255), data.description)
        .input('imageUrl', sql.VarChar(255), data.imageUrl)
        .input('requiredPoint', sql.Int, data.requiredPoint)
        .input('quantity', sql.Int, data.quantity)
        .query(`
            UPDATE Rewards
            SET rewardName = @rewardName,
                description = @description,
                imageUrl = @imageUrl,
                requiredPoint = @requiredPoint,
                quantity = @quantity
            WHERE rewardId = @rewardId
        `);
    return findById(rewardId);
};

const updateStatus = async (rewardId, status) => {
    pool = await poolPromise;
    await pool.request()
        .input('rewardId', sql.VarChar(36), rewardId)
        .input('status', sql.VarChar(20), status)
        .query(`
            UPDATE Rewards SET status = @status WHERE rewardId = @rewardId
        `);
    return findById(rewardId);
};

module.exports = {
    findPublicList,
    findPublicById,
    findAdminList,
    findById,
    create,
    update,
    updateStatus
};