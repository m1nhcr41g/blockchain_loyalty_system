const { sql, poolPromise } = require('../config/db');

// Kiểm tra tên sản phẩm đã tồn tại chưa (không phân biệt hoa thường)
const checkProductNameExists = async (productName, excludeProductId = null) => {
    const pool = await poolPromise;
    const request = pool.request()
        .input('productName', sql.NVarChar(100), productName);

    let query = 'SELECT productId FROM Products WHERE LOWER(productName) = LOWER(@productName)';
    if (excludeProductId) {
        query += ' AND productId <> @excludeProductId';
        request.input('excludeProductId', sql.VarChar(36), excludeProductId);
    }

    const result = await request.query(query);
    return result.recordset.length > 0;
};

// Thêm sản phẩm mới vào bảng Products
const createProduct = async ({ productId, productName, category, price, imageUrl }) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('productId', sql.VarChar(36), productId)
        .input('productName', sql.NVarChar(100), productName)
        .input('category', sql.NVarChar(50), category)
        .input('price', sql.Decimal(18, 2), price)
        .input('imageUrl', sql.VarChar(255), imageUrl)
        .query(`
            INSERT INTO Products (productId, productName, category, price, imageUrl)
            OUTPUT INSERTED.productId, INSERTED.productName, INSERTED.category, INSERTED.price, INSERTED.imageUrl, INSERTED.status
            VALUES (@productId, @productName, @category, @price, @imageUrl)
        `);
    return result.recordset[0];
};

// Lấy danh sách sản phẩm (hỗ trợ search, filter category/status, phân trang)
// Lấy danh sách sản phẩm (dùng chung cho cả Public và Admin)
const getProducts = async ({ search, category, status, offset, limit }) => {
    const pool = await poolPromise;
    const countRequest = pool.request();
    const dataRequest = pool.request();

    const conditions = ['1 = 1'];

    if (search) {
        conditions.push('productName LIKE @search');
        countRequest.input('search', sql.NVarChar(105), `%${search}%`);
        dataRequest.input('search', sql.NVarChar(105), `%${search}%`);
    }

    if (category) {
        conditions.push('LOWER(category) = LOWER(@category)');
        countRequest.input('category', sql.NVarChar(50), category);
        dataRequest.input('category', sql.NVarChar(50), category);
    }

    if (status) {
        conditions.push('status = @status');
        countRequest.input('status', sql.VarChar(20), status);
        dataRequest.input('status', sql.VarChar(20), status);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await countRequest.query(`
        SELECT COUNT(*) AS total
        FROM Products
        WHERE ${whereClause}
    `);

    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limit);

    const dataResult = await dataRequest.query(`
        SELECT productId, productName, category, price, imageUrl, status
        FROM Products
        WHERE ${whereClause}
        ORDER BY category ASC, productName ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return {
        items: dataResult.recordset,
        total: countResult.recordset[0].total
    };
};

// Lấy thông tin chi tiết 1 sản phẩm theo productId
const getProductById = async (productId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('productId', sql.VarChar(36), productId)
        .query(`
            SELECT productId, productName, category, price, imageUrl, status
            FROM Products
            WHERE productId = @productId
        `);
    return result.recordset[0] || null;
};

// Cập nhật thông tin sản phẩm
const updateProduct = async (productId, { productName, category, price, imageUrl }) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('productId', sql.VarChar(36), productId)
        .input('productName', sql.NVarChar(100), productName)
        .input('category', sql.NVarChar(50), category)
        .input('price', sql.Decimal(18, 2), price)
        .input('imageUrl', sql.VarChar(255), imageUrl)
        .query(`
            UPDATE Products
            SET productName = @productName,
                category = @category,
                price = @price,
                imageUrl = @imageUrl
            OUTPUT INSERTED.productId, INSERTED.productName, INSERTED.category, INSERTED.price, INSERTED.imageUrl, INSERTED.status
            WHERE productId = @productId
        `);
    return result.recordset[0];
};

// Cập nhật trạng thái kinh doanh sản phẩm (ACTIVE / INACTIVE)
const updateProductStatus = async (productId, status) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('productId', sql.VarChar(36), productId)
        .input('status', sql.VarChar(20), status)
        .query(`
            UPDATE Products
            SET status = @status
            OUTPUT INSERTED.productId, INSERTED.productName, INSERTED.category, INSERTED.price, INSERTED.imageUrl, INSERTED.status
            WHERE productId = @productId
        `);
    return result.recordset[0];
};

module.exports = {
    checkProductNameExists,
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    updateProductStatus
};