const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/reward.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');
const { uploadRewardImage } = require('../middlewares/upload.middleware');

// 1. Route tĩnh & Admin đặt lên trên
router.get('/', rewardController.getPublicRewards);
router.get('/admin', verifyToken, authorizeRoles('ADMIN'), rewardController.getAdminRewards);
router.get('/admin/:rewardId', verifyToken, authorizeRoles('ADMIN'), rewardController.getAdminRewardDetail);
router.post('/', verifyToken, authorizeRoles('ADMIN'), uploadRewardImage, rewardController.createReward);
router.patch('/:rewardId', verifyToken, authorizeRoles('ADMIN'), uploadRewardImage, rewardController.updateReward);
router.patch('/:rewardId/status', verifyToken, authorizeRoles('ADMIN'), rewardController.updateRewardStatus);

// 2. Route động đặt dưới cùng
router.get('/:rewardId', rewardController.getPublicRewardDetail);

module.exports = router;