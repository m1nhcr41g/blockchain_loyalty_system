const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const authRepo = require('../repositories/auth.repository');
const { createError } = require('../utils/response');

const registerCustomer = async ({ fullName, email, phone, password }) => {
    // 1. Kiểm tra đủ các trường bắt buộc
    if (!fullName || !email || !phone || !password) {
        throw createError('Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // 2. Chuẩn hóa dữ liệu trước khi kiểm tra regex
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanName = fullName.trim();

    if (!cleanName) {
        throw createError('Họ tên không được để trống', 400, 'INVALID_FULLNAME');
    }

    // 3. Validate Email & Tên miền
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        throw createError('Email không đúng định dạng (Ví dụ hợp lệ: example@gmail.com)', 400, 'INVALID_EMAIL');
    }

    // 4. Validate Số điện thoại Việt Nam (10 số)
    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
        throw createError('Số điện thoại không đúng định dạng (gồm 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09)', 400, 'INVALID_PHONE');
    }

    // 5. Validate Mật khẩu
    const cleanPassword = password.trim();
    if (cleanPassword.length < 6 || cleanPassword.length > 10) {
        throw createError('Mật khẩu phải có độ dài từ 6 đến 10 ký tự', 400, 'WEAK_PASSWORD');
    }

    // 6. Kiểm tra trùng email hoặc số điện thoại trong DB
    const existingUser = await authRepo.findUserByEmailOrPhone(cleanEmail, cleanPhone);
    if (existingUser) {
        if (existingUser.email.toLowerCase() === cleanEmail) {
            throw createError('Email này đã được sử dụng', 409, 'EMAIL_ALREADY_EXISTS');
        }
        throw createError('Số điện thoại này đã được sử dụng', 409, 'PHONE_ALREADY_EXISTS');
    }

    // 7. Sinh UUID (36 ký tự) và mã hóa mật khẩu
    const userId = crypto.randomUUID();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(cleanPassword, salt);

    // 8. Lưu vào SQL Server
    const createdCustomer = await authRepo.createCustomer({
        userId,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash
    });

    return createdCustomer;
};


const loginUser = async ({ email, password } = {}) => {
    // 1. Kiểm tra đủ email và mật khẩu
    if (!email || !password) {
        throw createError('Vui lòng nhập đầy đủ email và mật khẩu', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        throw createError('Email không đúng định dạng',400,'INVALID_EMAIL');
    }

    const cleanPassword = password.trim();

    // 2. Tái sử dụng hàm findUserByEmailOrPhone (truyền phone = null)
    const user = await authRepo.findUserByEmailOrPhone(cleanEmail, null);
    if (!user) {
        throw createError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    // 3. Kiểm tra trạng thái tài khoản (ACTIVE / INACTIVE)
    if (user.status !== 'ACTIVE') {
        throw createError('Tài khoản của bạn đã bị khóa', 403, 'ACCOUNT_INACTIVE');
    }

    // 4. So sánh mật khẩu người dùng nhập với mật khẩu đã hash trong DB
    const isMatch = await bcrypt.compare(cleanPassword, user.password);
    if (!isMatch) {
        throw createError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    // 5. Tạo JWT Token chứa thông tin userId, email, role
    const payload = {
        userId: user.userId,
        email: user.email,
        role: user.role
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
    });

    // 6. Trả về token và thông tin user (không trả về password)
    return {
        accessToken,
        user: {
            userId: user.userId,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status
        }
    };
};

module.exports = {
    registerCustomer,
    loginUser
};