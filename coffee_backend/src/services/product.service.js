const { v4: uuidv4 } = require('uuid');
const productRepo = require('../repositories/product.repository');
const { createError } = require('../utils/response');

const createProduct = async ({ productName, category, price, imageUrl } = {}) => {
    // 1. Kiểm tra các trường bắt buộc
    if (!productName || !category || price === undefined || price === null || price === '') {
        throw createError('Vui lòng nhập đầy đủ tên sản phẩm, danh mục và giá bán', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // 2. Validate tên sản phẩm
    if (typeof productName !== 'string' || typeof category !== 'string') {
        throw createError('Tên sản phẩm và danh mục phải là chuỗi ký tự', 400, 'INVALID_DATA_TYPE');
    }

    const cleanName = productName.trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
        throw createError('Tên sản phẩm phải có độ dài từ 2 đến 100 ký tự', 400, 'INVALID_PRODUCT_NAME');
    }

    // 3. Validate danh mục
    const cleanCategory = category.trim();
    if (cleanCategory.length < 2 || cleanCategory.length > 50) {
        throw createError('Danh mục phải có độ dài từ 2 đến 50 ký tự', 400, 'INVALID_CATEGORY');
    }

    // 4. Validate giá bán (phải là số >= 0 khớp với CHECK (price >= 0) trong DB)
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
        throw createError('Giá sản phẩm phải là số hợp lệ và lớn hơn hoặc bằng 0', 400, 'INVALID_PRICE');
    }

    // 5. Validate imageUrl (tùy chọn, nếu không truyền hoặc rỗng thì lưu NULL)
    let cleanImageUrl = null;
    if (imageUrl !== undefined && imageUrl !== null && String(imageUrl).trim() !== '') {
        cleanImageUrl = String(imageUrl).trim();
        if (cleanImageUrl.length > 255) {
            throw createError('Đường dẫn hình ảnh tối đa 255 ký tự', 400, 'INVALID_IMAGE_URL');
        }
    }

    // 6. Kiểm tra trùng tên sản phẩm
    const nameExists = await productRepo.checkProductNameExists(cleanName);
    if (nameExists) {
        throw createError('Tên sản phẩm này đã tồn tại trên hệ thống', 409, 'PRODUCT_NAME_EXISTS');
    }

    // 7. Tạo sản phẩm mới
    const productId = uuidv4();
    return productRepo.createProduct({
        productId,
        productName: cleanName,
        category: cleanCategory,
        price: numericPrice,
        imageUrl: cleanImageUrl
    });
};

//Xem danh sách sản phẩm đang kinh doanh (Public: Customer, Staff)
const getPublicProducts = async (query = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const search = query.search ? String(query.search).trim() : '';
    const category = query.category ? String(query.category).trim() : '';

    const { items, total } = await productRepo.getProducts({
        search,
        category,
        status: 'ACTIVE',
        offset,
        limit
    });

    return {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
};

//Xem chi tiết sản phẩm đang kinh doanh (Public: Customer, Staff)
const getPublicProductDetail = async (productId) => {
    const product = await productRepo.getProductById(productId);
    if (!product || product.status !== 'ACTIVE') {
        throw createError('Không tìm thấy sản phẩm', 404, 'PRODUCT_NOT_FOUND');
    }
    return product;
};

//Xem toàn bộ sản phẩm ACTIVE & INACTIVE (Admin)
const getAdminProducts = async (query = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const search = query.search ? String(query.search).trim() : '';
    const category = query.category ? String(query.category).trim() : '';
    const status = query.status ? String(query.status).trim().toUpperCase() : '';

    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
        throw createError('Trạng thái lọc không hợp lệ (chỉ chấp nhận ACTIVE hoặc INACTIVE)', 400, 'INVALID_STATUS');
    }

    const { items, total } = await productRepo.getProducts({
        search,
        category,
        status,
        offset,
        limit
    });

    return {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
};

// Xem chi tiết 1 sản phẩm bất kể ACTIVE hay INACTIVE (Admin)
const getAdminProductDetail = async (productId) => {
    const product = await productRepo.getProductById(productId);
    if (!product) {
        throw createError('Không tìm thấy sản phẩm', 404, 'PRODUCT_NOT_FOUND');
    }
    return product;
};

//Cập nhật thông tin sản phẩm (Admin)
const updateProduct = async (productId, { productName, category, price, imageUrl } = {}) => {
    const existingProduct = await productRepo.getProductById(productId);
    if (!existingProduct) {
        throw createError('Không tìm thấy sản phẩm', 404, 'PRODUCT_NOT_FOUND');
    }

    let cleanName = existingProduct.productName;
    if (productName !== undefined) {
        if (typeof productName !== 'string') {
            throw createError('Tên sản phẩm phải là chuỗi ký tự', 400, 'INVALID_DATA_TYPE');
        }
        cleanName = productName.trim();
        if (cleanName.length < 2 || cleanName.length > 100) {
            throw createError('Tên sản phẩm phải có độ dài từ 2 đến 100 ký tự', 400, 'INVALID_PRODUCT_NAME');
        }
        const nameExists = await productRepo.checkProductNameExists(cleanName, productId);
        if (nameExists) {
            throw createError('Tên sản phẩm này đã tồn tại trên hệ thống', 409, 'PRODUCT_NAME_EXISTS');
        }
    }

    let cleanCategory = existingProduct.category;
    if (category !== undefined) {
        if (typeof category !== 'string') {
            throw createError('Danh mục phải là chuỗi ký tự', 400, 'INVALID_DATA_TYPE');
        }
        cleanCategory = category.trim();
        if (cleanCategory.length < 2 || cleanCategory.length > 50) {
            throw createError('Danh mục phải có độ dài từ 2 đến 50 ký tự', 400, 'INVALID_CATEGORY');
        }
    }

    let numericPrice = existingProduct.price;
    if (price !== undefined) {
        if (price === null || price === '') {
            throw createError('Giá sản phẩm không được để trống', 400, 'INVALID_PRICE');
        }
        numericPrice = Number(price);
        if (Number.isNaN(numericPrice) || numericPrice < 0) {
            throw createError('Giá sản phẩm phải là số hợp lệ và lớn hơn hoặc bằng 0', 400, 'INVALID_PRICE');
        }
    }

    let cleanImageUrl = existingProduct.imageUrl;
    if (imageUrl !== undefined) {
        if (imageUrl === null || String(imageUrl).trim() === '') {
            cleanImageUrl = null;
        } else {
            cleanImageUrl = String(imageUrl).trim();
            if (cleanImageUrl.length > 255) {
                throw createError('Đường dẫn hình ảnh tối đa 255 ký tự', 400, 'INVALID_IMAGE_URL');
            }
        }
    }

    return productRepo.updateProduct(productId, {
        productName: cleanName,
        category: cleanCategory,
        price: numericPrice,
        imageUrl: cleanImageUrl
    });
};

// 6. Cập nhật trạng thái kinh doanh sản phẩm (Admin)
const updateProductStatus = async (productId, { status } = {}) => {
    if (!status || typeof status !== 'string') {
        throw createError('Vui lòng truyền trạng thái mới (ACTIVE hoặc INACTIVE)', 400, 'MISSING_STATUS');
    }

    const normalizedStatus = status.trim().toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
        throw createError('Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc INACTIVE)', 400, 'INVALID_STATUS');
    }

    const existingProduct = await productRepo.getProductById(productId);
    if (!existingProduct) {
        throw createError('Không tìm thấy sản phẩm', 404, 'PRODUCT_NOT_FOUND');
    }

    if (existingProduct.status === normalizedStatus) {
        throw createError(`Sản phẩm hiện đang ở trạng thái ${normalizedStatus}`, 400, 'STATUS_UNCHANGED');
    }

    return productRepo.updateProductStatus(productId, normalizedStatus);
};


module.exports = {
    createProduct,
    getPublicProducts,
    getPublicProductDetail,
    getAdminProducts,
    getAdminProductDetail,
    updateProduct,
    updateProductStatus
};