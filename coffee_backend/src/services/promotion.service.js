const { randomUUID } = require("crypto");
const promotionRepository = require("../repositories/promotion.repository");

function createError(message, statusCode, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}
function validatePromotion(data) {
    const {
        productId,promotionName,promotionType,bonusPoint,startDate,endDate
    } = data;

    if (!productId || typeof productId !== "string") {
        throw createError("productId không hợp lệ", 400, "INVALID_PRODUCT_ID");
    }

    if (!promotionName || typeof promotionName !== "string" || !promotionName.trim()) {
        throw createError("Tên chương trình khuyến mãi không được để trống", 400, "PROMOTION_NAME_REQUIRED");
    }

    if (promotionName.trim().length > 150) {
        throw createError("Tên chương trình tối đa 150 ký tự", 400, "INVALID_PROMOTION_NAME");
    }

    if (!promotionType || typeof promotionType !== "string" || !promotionType.trim()) {
        throw createError("Loại khuyến mãi không được để trống", 400, "PROMOTION_TYPE_REQUIRED");
    }

    if (promotionType.trim().length > 30) {
        throw createError("Loại khuyến mãi tối đa 30 ký tự", 400, "INVALID_PROMOTION_TYPE");
    }

    if (!Number.isInteger(bonusPoint) || bonusPoint <= 0) {
        throw createError("Điểm thưởng phải là số nguyên lớn hơn 0", 400, "INVALID_BONUS_POINT");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!startDate || Number.isNaN(start.getTime())) {
        throw createError("Ngày bắt đầu không hợp lệ", 400, "INVALID_START_DATE");
    }

    if (!endDate || Number.isNaN(end.getTime())) {
        throw createError("Ngày kết thúc không hợp lệ", 400, "INVALID_END_DATE");
    }
    if (end < start) {
        throw createError("Ngày kết thúc không được trước ngày bắt đầu", 400, "INVALID_PROMOTION_DATE_RANGE");
    }
    return {
        productId: productId.trim(),
        promotionName: promotionName.trim(),
        promotionType: promotionType.trim(),
        bonusPoint,
        startDate: start,
        endDate: end
    };
}

// GET /promotions
async function getAll(filters) {
    if (filters.status && !["ACTIVE", "INACTIVE"].includes(filters.status)) {
        throw createError("Trạng thái không hợp lệ", 400, "INVALID_PROMOTION_STATUS");
    }
    return await promotionRepository.getAll(filters);
}

// POST /promotions
async function create(data) {
    const promotion = validatePromotion(data);
    const exists = await promotionRepository.productExists(promotion.productId);
    if (!exists) {
        throw createError("Không tìm thấy sản phẩm", 404, "PRODUCT_NOT_FOUND");
    }
    promotion.promotionId = randomUUID();
    promotion.status = "ACTIVE";
    await promotionRepository.create(promotion);
    return await promotionRepository.getById(promotion.promotionId);
}

// PUT /promotions/:id
async function update(promotionId, data) {
    if (!promotionId) {
        throw createError("Thiếu promotionId", 400, "PROMOTION_ID_REQUIRED");
    }
    const existing = await promotionRepository.getById(promotionId);
    if (!existing) {
        throw createError("Không tìm thấy chương trình khuyến mãi", 404, "PROMOTION_NOT_FOUND");
    }
    const promotion = validatePromotion(data);
    const productExists = await promotionRepository.productExists(promotion.productId);
    if (!productExists) {
        throw createError("Không tìm thấy sản phẩm", 404, "PRODUCT_NOT_FOUND");
    }
    await promotionRepository.update(promotionId, promotion);
    return await promotionRepository.getById(promotionId);
}

// PATCH /promotions/:id/status
async function updateStatus(promotionId, status) {
    if (!promotionId) {
        throw createError("Thiếu promotionId", 400, "PROMOTION_ID_REQUIRED");
    }
    if (!["ACTIVE", "INACTIVE"].includes(status)) {
        throw createError("Trạng thái chỉ được là ACTIVE hoặc INACTIVE", 400, "INVALID_PROMOTION_STATUS");
    }
    const existing = await promotionRepository.getById(promotionId);
    if (!existing) {
        throw createError("Không tìm thấy chương trình khuyến mãi", 404, "PROMOTION_NOT_FOUND");
    }
    await promotionRepository.updateStatus(promotionId, status);
    return await promotionRepository.getById(promotionId);
}

module.exports = {
    getAll,
    create,
    update,
    updateStatus
};
