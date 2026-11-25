const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken, authorizeRoles('CUSTOMER'));

router.get('/profile', userController.getCustomerProfile);
router.patch('/profile', userController.updateCustomerProfile);
router.patch('/wallet', userController.linkCustomerWallet);
router.patch('/change-password', userController.changeCustomerPassword);

module.exports = router;