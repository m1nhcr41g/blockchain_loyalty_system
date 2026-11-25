const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');
const { addToBlacklist } = require('../utils/tokenBlacklist');

const register = async (req, res, next) => {
    try {
        const result = await authService.registerCustomer(req.body);
        return sendSuccess(res, 'Đăng ký tài khoản thành công', result, 201);
    } catch (error) {
        next(error); // Đẩy sang General Error Handler trong app.js
    }
};

const login = async (req, res, next) => {
    try {
        const result = await authService.loginUser(req.body);
        return sendSuccess(res, 'Đăng nhập thành công', result, 200);
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        addToBlacklist(req.token, req.user?.exp);
        return sendSuccess(res, 'Đăng xuất thành công', null, 200);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout
};