const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotion.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

//Các route tĩnh & danh sách đặt LÊN TRÊN
router.get('/types', promotionController.getPromotionTypes);
router.get('/', promotionController.getPublicPromotions);

// Các route Admin
router.get('/admin', verifyToken, authorizeRoles('ADMIN'), promotionController.getAdminPromotions);
router.get('/admin/:promotionId', verifyToken, authorizeRoles('ADMIN'), promotionController.getAdminPromotionDetail);
router.post('/', verifyToken, authorizeRoles('ADMIN'), promotionController.createPromotion);
router.patch('/:promotionId', verifyToken, authorizeRoles('ADMIN'), promotionController.updatePromotion);
router.patch('/:promotionId/status', verifyToken, authorizeRoles('ADMIN'), promotionController.updatePromotionStatus);

// Route chi tiết có param động :promotionId LUÔN ĐẶT DƯỚI CÙNG
router.get('/:promotionId', promotionController.getPublicPromotionDetail);

module.exports = router;