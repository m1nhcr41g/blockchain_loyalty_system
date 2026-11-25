const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { createError } = require('../utils/response');
const { isBlacklisted } = require('../utils/tokenBlacklist');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return next(createError('Vui lòng đăng nhập để tiếp tục (thiếu Token)', 401, 'UNAUTHORIZED'));
    }

    if (isBlacklisted(token)) {
        return next(createError('Phiên đăng nhập đã kết thúc, vui lòng đăng nhập lại', 401, 'TOKEN_REVOKED'));
    }

    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded; // { userId, email, role }
        req.token = token;// Lưu lại token hiện tại phục vụ API logout
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(createError('Token đã hết hạn',401,'TOKEN_EXPIRED' ));
        }
        
        return next(createError('Token không hợp lệ', 401, 'INVALID_TOKEN'));
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return next(createError('Bạn không có quyền truy cập chức năng này', 403, 'FORBIDDEN'));
        }
        next();
    };
};

module.exports = {
    verifyToken,
    authorizeRoles
};