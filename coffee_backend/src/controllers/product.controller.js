const productService = require('../services/product.service');
const { sendSuccess } = require('../utils/response');

// Helper tạo full URL từ file vừa upload
const buildImageUrl = (req) => {
    if (!req.file) return undefined;
    return `${req.protocol}://${req.get('host')}/uploads/products/${req.file.filename}`;
};

const createProduct = async (req, res, next) => {
    try {
        const uploadedImageUrl = buildImageUrl(req);
        const payload = {
            ...req.body,
            ...(uploadedImageUrl && { imageUrl: uploadedImageUrl })
        };

        const result = await productService.createProduct(payload);
        return sendSuccess(res, 'Thêm sản phẩm mới thành công', result, 201);
    } catch (error) {
        next(error);
    }
};

const getPublicProducts = async (req, res, next) => {
    try {
        const result = await productService.getPublicProducts(req.query);
        return sendSuccess(res, 'Lấy danh sách sản phẩm thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getPublicProductDetail = async (req, res, next) => {
    try {
        const result = await productService.getPublicProductDetail(req.params.productId);
        return sendSuccess(res, 'Lấy thông tin chi tiết sản phẩm thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getAdminProducts = async (req, res, next) => {
    try {
        const result = await productService.getAdminProducts(req.query);
        return sendSuccess(res, 'Lấy danh sách sản phẩm quản trị thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getAdminProductDetail = async (req, res, next) => {
    try {
        const result = await productService.getAdminProductDetail(req.params.productId);
        return sendSuccess(res, 'Lấy thông tin chi tiết sản phẩm quản trị thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const updateProduct = async (req, res, next) => {
    try {
        const uploadedImageUrl = buildImageUrl(req);
        const payload = {
            ...req.body,
            ...(uploadedImageUrl && { imageUrl: uploadedImageUrl })
        };

        const result = await productService.updateProduct(req.params.productId, payload);
        return sendSuccess(res, 'Cập nhật thông tin sản phẩm thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const updateProductStatus = async (req, res, next) => {
    try {
        const result = await productService.updateProductStatus(req.params.productId, req.body);
        return sendSuccess(res, 'Cập nhật trạng thái sản phẩm thành công', result, 200);
    } catch (error) {
        next(error);
    }
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