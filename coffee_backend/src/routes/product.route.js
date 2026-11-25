const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');
const { uploadProductImage } = require('../middlewares/upload.middleware');

// Admin routes 
router.get('/admin', verifyToken, authorizeRoles('ADMIN'), productController.getAdminProducts);
router.get('/admin/:productId', verifyToken, authorizeRoles('ADMIN'), productController.getAdminProductDetail);
router.post('/', verifyToken, authorizeRoles('ADMIN'),uploadProductImage,productController.createProduct);
router.patch('/:productId', verifyToken, authorizeRoles('ADMIN'), uploadProductImage,productController.updateProduct);
router.patch('/:productId/status', verifyToken, authorizeRoles('ADMIN'), productController.updateProductStatus);

// Public routes
router.get('/', productController.getPublicProducts);
router.get('/:productId', productController.getPublicProductDetail);


module.exports = router;