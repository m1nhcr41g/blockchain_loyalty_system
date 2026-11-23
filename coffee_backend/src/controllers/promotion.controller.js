const promotionService = require('../services/promotion.service');
const { sendSuccess } = require('../utils/response');

const getPromotionTypes = (req, res, next) => {
    try {
        const result = promotionService.getPromotionTypes();
        return sendSuccess(res, 'Lấy danh sách loại khuyến mãi thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const createPromotion = async (req, res, next) => {
    try {
        const result = await promotionService.createPromotion(req.body);
        return sendSuccess(res, 'Tạo chương trình khuyến mãi thành công', result, 201);
    } catch (error) {
        next(error);
    }
};

const getPublicPromotions = async (req, res, next) => {
    try {
        const result = await promotionService.getPublicPromotions(req.query);
        return sendSuccess(res, 'Lấy danh sách khuyến mãi đang áp dụng thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getPublicPromotionDetail = async (req, res, next) => {
    try {
        const result = await promotionService.getPublicPromotionDetail(req.params.promotionId);
        return sendSuccess(res, 'Lấy thông tin chi tiết khuyến mãi thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getAdminPromotions = async (req, res, next) => {
    try {
        const result = await promotionService.getAdminPromotions(req.query);
        return sendSuccess(res, 'Lấy danh sách khuyến mãi quản trị thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getAdminPromotionDetail = async (req, res, next) => {
    try {
        const result = await promotionService.getAdminPromotionDetail(req.params.promotionId);
        return sendSuccess(res, 'Lấy thông tin chi tiết khuyến mãi quản trị thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const updatePromotion = async (req, res, next) => {
    try {
        const result = await promotionService.updatePromotion(req.params.promotionId, req.body);
        return sendSuccess(res, 'Cập nhật chương trình khuyến mãi thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const updatePromotionStatus = async (req, res, next) => {
    try {
        const result = await promotionService.updatePromotionStatus(req.params.promotionId, req.body);
        return sendSuccess(res, 'Cập nhật trạng thái khuyến mãi thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPromotionTypes,
    createPromotion,
    getPublicPromotions,
    getPublicPromotionDetail,
    getAdminPromotions,
    getAdminPromotionDetail,
    updatePromotion,
    updatePromotionStatus
};