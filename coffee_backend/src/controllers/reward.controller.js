const rewardService = require('../services/reward.service');

const buildImageUrl = (req) => {
    if (!req.file) return null;
    return `${req.protocol}://${req.get('host')}/uploads/rewards/${req.file.filename}`;
};

const getPublicRewards = async (req, res, next) => {
    try {
        const data = await rewardService.getPublicRewards(req.query);
        res.status(200).json({
            success: true,
            message: 'Lấy danh sách quà tặng thành công',
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
};

const getPublicRewardDetail = async (req, res, next) => {
    try {
        const data = await rewardService.getPublicRewardDetail(req.params.rewardId);
        res.status(200).json({
            success: true,
            message: 'Lấy chi tiết quà tặng thành công',
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
};

const getAdminRewards = async (req, res, next) => {
    try {
        const data = await rewardService.getAdminRewards(req.query);
        res.status(200).json({
            success: true,
            message: 'Lấy danh sách quà tặng quản trị thành công',
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
};

const createReward = async (req, res, next) => {
    try {
        const imageUrl = buildImageUrl(req);
        const data = await rewardService.createReward(req.body, imageUrl);
        res.status(201).json({
            success: true,
            message: 'Tạo quà tặng mới thành công',
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
};

const updateReward = async (req, res, next) => {
    try {
        const imageUrl = buildImageUrl(req);
        const data = await rewardService.updateReward(req.params.rewardId, req.body, imageUrl);
        res.status(200).json({
            success: true,
            message: 'Cập nhật quà tặng thành công',
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
};

const updateRewardStatus = async (req, res, next) => {
    try {
        const data = await rewardService.updateRewardStatus(req.params.rewardId, req.body.status);
        res.status(200).json({
            success: true,
            message: 'Cập nhật trạng thái quà tặng thành công',
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
};

const getAdminRewardDetail = async (req, res, next) => {
    try {
        const data = await rewardService.getAdminRewardDetail(req.params.rewardId);
        res.status(200).json({
            success: true,
            message: 'Lấy chi tiết quà tặng quản trị thành công',
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
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