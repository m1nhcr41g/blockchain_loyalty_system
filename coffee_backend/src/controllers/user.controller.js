const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/response');

const getCustomerProfile = async (req, res, next) => {
    try {
        const result = await userService.getProfile(req.user.userId);
        return sendSuccess(res, 'Lấy thông tin cá nhân thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const updateCustomerProfile = async (req, res, next) => {
    try {
        const result = await userService.updateProfile(req.user.userId, req.body);
        return sendSuccess(res, 'Cập nhật thông tin cá nhân thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const linkCustomerWallet = async (req, res, next) => {
    try {
        const result = await userService.linkWallet(req.user.userId, req.body);
        return sendSuccess(res, 'Liên kết địa chỉ ví Blockchain thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const createStaff = async (req, res, next) => {
    try {
        const result = await userService.createStaffAccount(req.body);
        return sendSuccess(res, 'Tạo tài khoản nhân viên thành công', result, 201);
    } catch (error) {
        next(error);
    }
};

const getStaffs = async (req, res, next) => {
    try {
        const result = await userService.getStaffList();
        return sendSuccess(res, 'Lấy danh sách nhân viên thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getUsers = async (req, res, next) => {
    try {
        const result = await userService.getUsers(req.query);
        return sendSuccess(res, 'Lấy danh sách người dùng thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const getUserDetail = async (req, res, next) => {
    try {
        const result = await userService.getUserDetail(req.params.userId);
        return sendSuccess(res, 'Lấy thông tin chi tiết người dùng thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const updateUserStatus = async (req, res, next) => {
    try {
        const result = await userService.changeUserStatus(req.user.userId, req.params.userId, req.body);
        const actionText = result.status === 'INACTIVE' ? 'Khóa tài khoản thành công' : 'Mở khóa tài khoản thành công';
        return sendSuccess(res, actionText, result, 200);
    } catch (error) {
        next(error);
    }
};

const changeCustomerPassword = async (req, res, next) => {
    try {
        await userService.changeCustomerPassword(req.user.userId, req.body);
        return sendSuccess(res, 'Đổi mật khẩu thành công', null, 200);
    } catch (error) {
        next(error);
    }
};


const updateStaff = async (req, res, next) => {
    try {
        const result = await userService.updateStaff(req.params.userId, req.body);
        return sendSuccess(res, 'Cập nhật thông tin nhân viên thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const resetStaffPassword = async (req, res, next) => {
    try {
        await userService.resetStaffPassword(req.params.userId, req.body);
        return sendSuccess(res, 'Đặt lại mật khẩu cho nhân viên thành công', null, 200);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCustomerProfile,
    updateCustomerProfile,
    linkCustomerWallet,
    createStaff,
    getStaffs,
    getUsers,
    getUserDetail,
    updateUserStatus,
    changeCustomerPassword,
    updateStaff,
    resetStaffPassword
};