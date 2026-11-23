const { v4: uuidv4 } = require('uuid');
const promotionRepo = require('../repositories/promotion.repository');
const { createError } = require('../utils/response');

const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE'];

const PROMOTION_TYPES = [
    { code: 'BONUS_POINT', label: 'Cộng điểm thưởng' },
];

const ALLOWED_PROMOTION_TYPE_CODES = PROMOTION_TYPES.map((item) => item.code);

// Validate ngày hợp lệ
const parseValidDate = (dateInput, fieldName) => {
    const parsed = new Date(dateInput);

    if (!dateInput || Number.isNaN(parsed.getTime())) {
        throw createError(
            `${fieldName} không hợp lệ (ví dụ: 2026-11-20T00:00:00Z)`,
            400,
            'INVALID_DATE'
        );
    }

    return parsed;
};

// 0. Lấy danh sách loại khuyến mãi hợp lệ (cho Dropdown Frontend)
const getPromotionTypes = () => {
    return PROMOTION_TYPES;
};

// 1. [ADMIN] Tạo chương trình khuyến mãi
const createPromotion = async (data = {}) => {
    const {
        productId,
        promotionName,
        promotionType,
        bonusPoint,
        startDate,
        endDate
    } = data;

    if (
        !productId ||
        !promotionName ||
        !promotionType ||
        bonusPoint === undefined ||
        !startDate ||
        !endDate
    ) {
        throw createError(
            'Vui lòng nhập đầy đủ productId, promotionName, promotionType, bonusPoint, startDate và endDate',
            400,
            'MISSING_REQUIRED_FIELDS'
        );
    }

    const cleanProductId = String(productId).trim();
    const cleanPromotionName = String(promotionName).trim();
    const cleanPromotionType = String(promotionType).trim().toUpperCase();
    const numericBonusPoint = Number(bonusPoint);

    if (!cleanPromotionName) {
        throw createError('Tên chương trình khuyến mãi không được để trống', 400, 'INVALID_PROMOTION_NAME');
    }

    if (!ALLOWED_PROMOTION_TYPE_CODES.includes(cleanPromotionType)) {
        throw createError(
            `promotionType không hợp lệ. Chỉ chấp nhận: ${ALLOWED_PROMOTION_TYPE_CODES.join(', ')}`,
            400,
            'INVALID_PROMOTION_TYPE'
        );
    }

    if (!Number.isInteger(numericBonusPoint) || numericBonusPoint <= 0) {
        throw createError('bonusPoint phải là số nguyên lớn hơn 0', 400, 'INVALID_BONUS_POINT');
    }

    const parsedStartDate = parseValidDate(startDate, 'Ngày bắt đầu (startDate)');
    const parsedEndDate = parseValidDate(endDate, 'Ngày kết thúc (endDate)');

    if (parsedEndDate < parsedStartDate) {
        throw createError('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu', 400, 'INVALID_DATE_RANGE');
    }

    const product = await promotionRepo.findProductById(cleanProductId);
    if (!product) {
        throw createError('Không tìm thấy sản phẩm áp dụng khuyến mãi', 404, 'PRODUCT_NOT_FOUND');
    }

    if (product.status !== 'ACTIVE') {
        throw createError('Chỉ được tạo khuyến mãi cho sản phẩm đang ở trạng thái ACTIVE', 400, 'PRODUCT_INACTIVE');
    }

    const overlap = await promotionRepo.findOverlappingPromotion(
        cleanProductId,
        parsedStartDate,
        parsedEndDate
    );

    if (overlap) {
        throw createError(
            `Sản phẩm đã có khuyến mãi "${overlap.promotionName}" trong khoảng thời gian này`,
            409,
            'PROMOTION_OVERLAP'
        );
    }

    const created = await promotionRepo.create({
        promotionId: uuidv4(),
        productId: cleanProductId,
        promotionName: cleanPromotionName,
        promotionType: cleanPromotionType,
        bonusPoint: numericBonusPoint,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        status: 'ACTIVE'
    });

    return {
        ...created,
        productName: product.productName,
        productImageUrl: product.productImageUrl
    };
};

// 2. [PUBLIC] Danh sách khuyến mãi đang áp dụng
const getPublicPromotions = async (query = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const search = query.search ? String(query.search).trim() : '';
    const productId = query.productId ? String(query.productId).trim() : '';

    const { items, total } = await promotionRepo.findPublicList({
        offset,
        limit,
        search,
        productId
    });

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

// 3. [PUBLIC] Chi tiết khuyến mãi đang áp dụng
const getPublicPromotionDetail = async (promotionId) => {
    const promotion = await promotionRepo.findPublicById(promotionId);

    if (!promotion) {
        throw createError(
            'Không tìm thấy chương trình khuyến mãi hoặc khuyến mãi đã hết hạn',
            404,
            'PROMOTION_NOT_FOUND'
        );
    }

    return promotion;
};

// 4. [ADMIN] Danh sách tất cả khuyến mãi
const getAdminPromotions = async (query = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const search = query.search ? String(query.search).trim() : '';
    const status = query.status ? String(query.status).trim().toUpperCase() : '';
    const productId = query.productId ? String(query.productId).trim() : '';

    if (status && !ALLOWED_STATUSES.includes(status)) {
        throw createError('Trạng thái lọc chỉ chấp nhận ACTIVE hoặc INACTIVE', 400, 'INVALID_STATUS');
    }

    const { items, total } = await promotionRepo.findAdminList({
        offset,
        limit,
        search,
        status,
        productId
    });

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

// 5. [ADMIN] Chi tiết khuyến mãi
const getAdminPromotionDetail = async (promotionId) => {
    const promotion = await promotionRepo.findAdminById(promotionId);

    if (!promotion) {
        throw createError('Không tìm thấy chương trình khuyến mãi', 404, 'PROMOTION_NOT_FOUND');
    }

    return promotion;
};

// 6. [ADMIN] Cập nhật thông tin khuyến mãi
const updatePromotion = async (promotionId, data = {}) => {
    const current = await promotionRepo.findRawById(promotionId);

    if (!current) {
        throw createError('Không tìm thấy chương trình khuyến mãi', 404, 'PROMOTION_NOT_FOUND');
    }

    const updatedProductId = data.productId !== undefined ? String(data.productId).trim() : current.productId;
    const updatedName = data.promotionName !== undefined ? String(data.promotionName).trim() : current.promotionName;
    const updatedType = data.promotionType !== undefined ? String(data.promotionType).trim().toUpperCase() : current.promotionType;
    const updatedBonusPoint = data.bonusPoint !== undefined ? Number(data.bonusPoint) : current.bonusPoint;
    const updatedStartDate = data.startDate !== undefined
        ? parseValidDate(data.startDate, 'Ngày bắt đầu (startDate)')
        : new Date(current.startDate);
    const updatedEndDate = data.endDate !== undefined
        ? parseValidDate(data.endDate, 'Ngày kết thúc (endDate)')
        : new Date(current.endDate);

    if (!updatedName) {
        throw createError('Tên khuyến mãi không được để trống', 400, 'INVALID_INPUT');
    }

    if (!ALLOWED_PROMOTION_TYPE_CODES.includes(updatedType)) {
        throw createError(
            `promotionType không hợp lệ. Chỉ chấp nhận: ${ALLOWED_PROMOTION_TYPE_CODES.join(', ')}`,
            400,
            'INVALID_PROMOTION_TYPE'
        );
    }

    if (!Number.isInteger(updatedBonusPoint) || updatedBonusPoint <= 0) {
        throw createError('bonusPoint phải là số nguyên lớn hơn 0', 400, 'INVALID_BONUS_POINT');
    }

    if (updatedEndDate < updatedStartDate) {
        throw createError('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu', 400, 'INVALID_DATE_RANGE');
    }

    const product = await promotionRepo.findProductById(updatedProductId);
    if (!product) {
        throw createError('Không tìm thấy sản phẩm áp dụng khuyến mãi', 404, 'PRODUCT_NOT_FOUND');
    }

    if (product.status !== 'ACTIVE') {
        throw createError('Chỉ được áp dụng khuyến mãi cho sản phẩm đang ở trạng thái ACTIVE', 400, 'PRODUCT_INACTIVE');
    }

    if (current.status === 'ACTIVE') {
        const overlap = await promotionRepo.findOverlappingPromotion(
            updatedProductId,
            updatedStartDate,
            updatedEndDate,
            promotionId
        );

        if (overlap) {
            throw createError(
                `Sản phẩm đã có khuyến mãi "${overlap.promotionName}" trong khoảng thời gian này`,
                409,
                'PROMOTION_OVERLAP'
            );
        }
    }

    const updated = await promotionRepo.update(promotionId, {
        productId: updatedProductId,
        promotionName: updatedName,
        promotionType: updatedType,
        bonusPoint: updatedBonusPoint,
        startDate: updatedStartDate,
        endDate: updatedEndDate
    });

    return {
        ...updated,
        productName: product.productName,
        productImageUrl: product.productImageUrl
    };
};

// 7. [ADMIN] Cập nhật trạng thái ACTIVE / INACTIVE
const updatePromotionStatus = async (promotionId, data = {}) => {
    const status = data.status ? String(data.status).trim().toUpperCase() : '';

    if (!ALLOWED_STATUSES.includes(status)) {
        throw createError('Trạng thái chỉ chấp nhận ACTIVE hoặc INACTIVE', 400, 'INVALID_STATUS');
    }

    const current = await promotionRepo.findRawById(promotionId);
    if (!current) {
        throw createError('Không tìm thấy chương trình khuyến mãi', 404, 'PROMOTION_NOT_FOUND');
    }

    if (status === 'ACTIVE' && current.status !== 'ACTIVE') {
        const overlap = await promotionRepo.findOverlappingPromotion(
            current.productId,
            new Date(current.startDate),
            new Date(current.endDate),
            promotionId
        );

        if (overlap) {
            throw createError(
                `Không thể kích hoạt vì sản phẩm đang có khuyến mãi "${overlap.promotionName}" trùng thời gian`,
                409,
                'PROMOTION_OVERLAP'
            );
        }
    }

    const updated = await promotionRepo.updateStatus(promotionId, status);

    return {
        ...updated,
        promotionName: current.promotionName
    };
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