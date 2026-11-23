const { v4: uuidv4 } = require('uuid');
const rewardRepo = require('../repositories/reward.repository');
const { createError } = require('../utils/response');

const getPublicRewards = async (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100,Math.max(1, parseInt(query.limit, 10) || 10));
    const search = (query.search || '').trim();
    const inStockOnly = query.inStockOnly === 'true';

    const { items, total } = await rewardRepo.findPublicList({ page, limit, search, inStockOnly });
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

const getPublicRewardDetail = async (rewardId) => {
    const reward = await rewardRepo.findPublicById(rewardId);
    if (!reward) {
        throw createError('Không tìm thấy quà tặng hoặc quà tặng đã ngừng áp dụng', 404, 'REWARD_NOT_FOUND');
    }
    return reward;
};

const getAdminRewards = async (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100,Math.max(1, parseInt(query.limit, 10) || 10));
    const search = (query.search || '').trim();
    const status = (query.status || '').trim().toUpperCase();

    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
        throw createError('Trạng thái lọc chỉ chấp nhận ACTIVE hoặc INACTIVE', 400, 'INVALID_STATUS');
    }

    const { items, total } = await rewardRepo.findAdminList({ page, limit, search, status });
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

const createReward = async (payload, imageUrl) => {
    const { rewardName, description, requiredPoint, quantity } = payload;
    if (!rewardName || requiredPoint === undefined || requiredPoint === '') {
        throw createError('Thiếu tên quà tặng (rewardName) hoặc số điểm quy đổi (requiredPoint)', 400, 'MISSING_REQUIRED_FIELDS');
    }
    const cleanRewardName = rewardName.trim();
    if (!cleanRewardName) {
        throw createError('Tên quà tặng không được để trống',400,'INVALID_REWARD_NAME');
    }

    const parsedPoint = Number(requiredPoint);
    if (!Number.isInteger(parsedPoint) || parsedPoint <= 0) {
        throw createError('Số điểm quy đổi phải là số nguyên lớn hơn 0', 400, 'INVALID_REQUIRED_POINT');
    }

    const parsedQuantity = quantity !== undefined && quantity !== '' ? Number(quantity) : 0;
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
        throw createError('Số lượng tồn kho phải là số nguyên lớn hơn hoặc bằng 0', 400, 'INVALID_QUANTITY');
    }

    return rewardRepo.create({
        rewardId: uuidv4(),
        rewardName: cleanRewardName,
        description: description ? description.trim() : null,
        imageUrl: imageUrl || payload.imageUrl || null,
        requiredPoint: parsedPoint,
        quantity: parsedQuantity,
        status: 'ACTIVE'
    });
};

const updateReward = async (rewardId, payload, newImageUrl) => {
    const existing = await rewardRepo.findById(rewardId);
    if (!existing) {
        throw createError('Không tìm thấy quà tặng', 404, 'REWARD_NOT_FOUND');
    }

    const rewardName = payload.rewardName !== undefined ? payload.rewardName.trim() : existing.rewardName;
    if (!rewardName) {
        throw createError('Tên quà tặng không được để trống', 400, 'INVALID_REWARD_NAME');
    }

    const description = payload.description !== undefined
        ? (payload.description ? payload.description.trim() : null)
        : existing.description;

    const requiredPoint = payload.requiredPoint !== undefined && payload.requiredPoint !== ''
        ? Number(payload.requiredPoint)
        : existing.requiredPoint;
    if (!Number.isInteger(requiredPoint) || requiredPoint <= 0) {
        throw createError('Số điểm quy đổi phải là số nguyên lớn hơn 0', 400, 'INVALID_REQUIRED_POINT');
    }

    const quantity = payload.quantity !== undefined && payload.quantity !== ''
        ? Number(payload.quantity)
        : existing.quantity;
    if (!Number.isInteger(quantity) || quantity < 0) {
        throw createError('Số lượng tồn kho phải là số nguyên lớn hơn hoặc bằng 0', 400, 'INVALID_QUANTITY');
    }

    const imageUrl = newImageUrl || (payload.imageUrl !== undefined ? payload.imageUrl : existing.imageUrl);

    return rewardRepo.update(rewardId, {
        rewardName,
        description,
        imageUrl,
        requiredPoint,
        quantity
    });
};

const updateRewardStatus = async (rewardId, status) => {
    const normalizedStatus = (status || '').trim().toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
        throw createError('Trạng thái chỉ chấp nhận ACTIVE hoặc INACTIVE', 400, 'INVALID_STATUS');
    }

    const existing = await rewardRepo.findById(rewardId);
    if (!existing) {
        throw createError('Không tìm thấy quà tặng', 404, 'REWARD_NOT_FOUND');
    }

    return rewardRepo.updateStatus(rewardId, normalizedStatus);
};

const getAdminRewardDetail = async (rewardId) => {
    const reward = await rewardRepo.findById(rewardId);
    if (!reward) {
        throw createError('Không tìm thấy quà tặng', 404, 'REWARD_NOT_FOUND');
    }
    return reward;
};

module.exports = {
    getPublicRewards,
    getPublicRewardDetail,
    getAdminRewards,
    getAdminRewardDetail,
    createReward,
    updateReward,
    updateRewardStatus
};