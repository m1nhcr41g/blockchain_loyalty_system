const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken, authorizeRoles('ADMIN'));

router.post('/staff', userController.createStaff);
router.get('/staff', userController.getStaffs);
router.patch('/staff/:userId', userController.updateStaff);
router.patch('/staff/:userId/reset-password', userController.resetStaffPassword);

router.get('/', userController.getUsers);
router.get('/:userId', userController.getUserDetail);
router.patch('/:userId/status', userController.updateUserStatus);

module.exports = router;