const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/user.repository');
const authRepo = require('../repositories/auth.repository');
const { createError } = require('../utils/response');

// --- CUSTOMER ---
const getProfile = async (userId) => {
    const profile = await userRepo.getCustomerProfile(userId);
    if (!profile) {
        throw createError('Không tìm thấy thông tin khách hàng', 404, 'CUSTOMER_NOT_FOUND');
    }
    return profile;
};

const updateProfile = async (userId, { fullName, phone } = {}) => {
    if (!fullName && !phone) {
        throw createError('Vui lòng cung cấp họ tên hoặc số điện thoại cần cập nhật', 400, 'MISSING_UPDATE_FIELDS');
    }

    let cleanName = null;
    if (fullName !== undefined) {
        cleanName = fullName.trim();
        if (!cleanName) {
            throw createError('Họ tên không được để trống', 400, 'INVALID_FULLNAME');
        }
    }

    let cleanPhone = null;
    if (phone !== undefined) {
        cleanPhone = phone.trim();
        const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
        if (!phoneRegex.test(cleanPhone)) {
            throw createError('Số điện thoại không đúng định dạng', 400, 'INVALID_PHONE');
        }
        const phoneTaken = await userRepo.checkPhoneExists(cleanPhone, userId);
        if (phoneTaken) {
            throw createError('Số điện thoại này đã được sử dụng bởi tài khoản khác', 409, 'PHONE_ALREADY_EXISTS');
        }
    }

    return userRepo.updateCustomerProfile(userId, { fullName: cleanName, phone: cleanPhone });
};

const linkWallet = async (userId, { walletAddress } = {}) => {
    if (!walletAddress) {
        throw createError('Vui lòng nhập địa chỉ ví Blockchain', 400, 'MISSING_WALLET_ADDRESS');
    }

    const cleanWallet = walletAddress.trim();
    const ethWalletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethWalletRegex.test(cleanWallet)) {
        throw createError('Địa chỉ ví Blockchain không hợp lệ (định dạng 0x... gồm 42 ký tự)', 400, 'INVALID_WALLET_ADDRESS');
    }

    //Lấy thông tin khách hàng hiện tại
    const customer = await userRepo.getCustomerProfile(userId);
    if (!customer) {
        throw createError('Không tìm thấy thông tin khách hàng', 404, 'CUSTOMER_NOT_FOUND');
    }

    //Cố định 1 khách hàng chỉ liên kết 1 ví duy nhất: đã có ví thì chặn không cho đổi
    if (customer.walletAddress) {
        throw createError('Tài khoản của bạn đã liên kết ví Blockchain và không thể thay đổi', 409, 'WALLET_ALREADY_BOUND');
    }

    //Kiểm tra ví này đã bị tài khoản khác dùng chưa
    const walletTaken = await userRepo.checkWalletExists(cleanWallet, userId);
    if (walletTaken) {
        throw createError('Địa chỉ ví này đã được liên kết với một tài khoản khác', 409, 'WALLET_ALREADY_LINKED');
    }

    return userRepo.updateCustomerWallet(userId, cleanWallet);
};

// --- STAFF (ADMIN) ---
const createStaffAccount = async ({ fullName, email, phone, password, employeeCode } = {}) => {
    if (!fullName || !email || !phone || !password || !employeeCode) {
        throw createError('Vui lòng nhập đầy đủ họ tên, email, số điện thoại, mật khẩu và mã nhân viên', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();
    const cleanCode = employeeCode.trim().toUpperCase();

    if (!cleanName) {
        throw createError('Họ tên không được để trống', 400, 'INVALID_FULLNAME');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        throw createError('Email không đúng định dạng', 400, 'INVALID_EMAIL');
    }

    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
        throw createError('Số điện thoại không đúng định dạng', 400, 'INVALID_PHONE');
    }

    if (cleanPassword.length < 6 || cleanPassword.length > 10) {
        throw createError('Mật khẩu phải có độ dài từ 6 đến 10 ký tự', 400, 'WEAK_PASSWORD');
    }

    // Kiểm tra trùng email, SĐT hoặc employeeCode
    const existingUser = await authRepo.findUserByEmailOrPhone(cleanEmail, cleanPhone);
    if (existingUser) {
        if (existingUser.email.toLowerCase() === cleanEmail) {
            throw createError('Email này đã được sử dụng', 409, 'EMAIL_ALREADY_EXISTS');
        }
        throw createError('Số điện thoại này đã được sử dụng', 409, 'PHONE_ALREADY_EXISTS');
    }

    const codeTaken = await userRepo.checkEmployeeCodeExists(cleanCode);
    if (codeTaken) {
        throw createError('Mã nhân viên này đã tồn tại', 409, 'EMPLOYEE_CODE_EXISTS');
    }

    const userId = crypto.randomUUID();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(cleanPassword, salt);

    return userRepo.createStaff({
        userId,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        employeeCode: cleanCode
    });
};

const getStaffList = async () => {
    return userRepo.getAllStaffs();
};

const getUsers = async ({ search, role, status, page = 1, limit = 10 } = {}) => {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    if (isNaN(parsedPage) || parsedPage < 1 || isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw createError('Tham số phân trang không hợp lệ (page >= 1, 1 <= limit <= 100)', 400, 'INVALID_PAGINATION');
    }

    const filters = {
        page: parsedPage,
        limit: parsedLimit
    };

    if (search && search.trim()) {
        filters.search = search.trim();
    }

    if (role) {
        const cleanRole = role.trim().toUpperCase();
        if (!['ADMIN', 'STAFF', 'CUSTOMER'].includes(cleanRole)) {
            throw createError('Role lọc không hợp lệ (chỉ nhận ADMIN, STAFF, CUSTOMER)', 400, 'INVALID_ROLE');
        }
        filters.role = cleanRole;
    }

    if (status) {
        const cleanStatus = status.trim().toUpperCase();
        if (!['ACTIVE', 'INACTIVE'].includes(cleanStatus)) {
            throw createError('Trạng thái lọc không hợp lệ (chỉ nhận ACTIVE, INACTIVE)', 400, 'INVALID_STATUS');
        }
        filters.status = cleanStatus;
    }

    return userRepo.getAllUsers(filters);
};

const getUserDetail = async (targetUserId) => {
    const user = await userRepo.getUserDetailById(targetUserId);
    if (!user) {
        throw createError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
    }
    return user;
};

const changeUserStatus = async (adminUserId, targetUserId, { status } = {}) => {
    if (!status) {
        throw createError('Vui lòng cung cấp trạng thái mới (ACTIVE hoặc INACTIVE)', 400, 'MISSING_STATUS');
    }

    const cleanStatus = status.trim().toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(cleanStatus)) {
        throw createError('Trạng thái không hợp lệ (chỉ nhận ACTIVE hoặc INACTIVE)', 400, 'INVALID_STATUS');
    }

    // Chặn Admin tự khóa chính mình
    if (adminUserId === targetUserId && cleanStatus === 'INACTIVE') {
        throw createError('Bạn không thể tự khóa tài khoản Admin đang đăng nhập', 400, 'CANNOT_LOCK_SELF');
    }

    const existingUser = await userRepo.getUserDetailById(targetUserId);
    if (!existingUser) {
        throw createError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
    }

    if (existingUser.status === cleanStatus) {
        throw createError(`Tài khoản hiện đang ở trạng thái ${cleanStatus} rồi`, 400, 'STATUS_UNCHANGED');
    }

    return userRepo.updateUserStatus(targetUserId, cleanStatus);
};

const changeCustomerPassword = async (userId, { oldPassword, newPassword } = {}) => {
    //Kiểm tra đủ dữ liệu đầu vào
    if (!oldPassword || !newPassword) {
        throw createError('Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const cleanOldPass = oldPassword.trim();
    const cleanNewPass = newPassword.trim();

    //Kiểm tra độ dài mật khẩu mới (6 - 10 ký tự)
    if (cleanNewPass.length < 6 || cleanNewPass.length > 10) {
        throw createError('Mật khẩu mới phải có độ dài từ 6 đến 10 ký tự', 400, 'WEAK_PASSWORD');
    }

    //Lấy thông tin user từ DB để kiểm tra mật khẩu
    const user = await userRepo.getUserPasswordById(userId);
    if (!user) {
        throw createError('Không tìm thấy tài khoản người dùng', 404, 'USER_NOT_FOUND');
    }

    //Kiểm tra mật khẩu cũ có khớp không
    const isMatch = await bcrypt.compare(cleanOldPass, user.password);
    if (!isMatch) {
        throw createError('Mật khẩu cũ không chính xác', 401, 'INVALID_OLD_PASSWORD');
    }

    //Không cho phép mật khẩu mới trùng mật khẩu hiện tại trong DB
    const isSamePassword = await bcrypt.compare(cleanNewPass, user.password);
    if (isSamePassword) {
        throw createError('Mật khẩu mới không được trùng với mật khẩu hiện tại', 400, 'SAME_PASSWORD');
    }

    //Mã hóa mật khẩu mới và lưu vào DB
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(cleanNewPass, salt);
    await userRepo.updateUserPassword(userId, newPasswordHash);
};


const updateStaff = async (targetUserId, { fullName, phone, employeeCode } = {}) => {
    const existingUser = await userRepo.getUserDetailById(targetUserId);
    if (!existingUser) {
        throw createError('Không tìm thấy nhân viên', 404, 'STAFF_NOT_FOUND');
    }
    if (existingUser.role !== 'STAFF') {
        throw createError('Tài khoản này không phải là nhân viên (STAFF)', 400, 'NOT_A_STAFF');
    }

    if (fullName === undefined && phone === undefined && employeeCode === undefined) {
        throw createError('Vui lòng cung cấp ít nhất một thông tin cần cập nhật (fullName, phone, employeeCode)', 400, 'MISSING_UPDATE_FIELDS');
    }

    const updateData = {};

    if (fullName !== undefined) {
        const cleanName = fullName.trim();
        if (cleanName.length < 2 || cleanName.length > 100) {
            throw createError('Họ tên phải từ 2 đến 100 ký tự', 400, 'INVALID_FULLNAME');
        }
        updateData.fullName = cleanName;
    }

    if (phone !== undefined) {
        const cleanPhone = phone.trim();
        const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
        if (!phoneRegex.test(cleanPhone)) {
            throw createError('Số điện thoại không đúng định dạng Việt Nam', 400, 'INVALID_PHONE');
        }
        const phoneTaken = await userRepo.checkPhoneExists(cleanPhone, targetUserId);
        if (phoneTaken) {
            throw createError('Số điện thoại này đã được sử dụng bởi tài khoản khác', 409, 'PHONE_ALREADY_EXISTS');
        }
        updateData.phone = cleanPhone;
    }

    if (employeeCode !== undefined) {
        const cleanCode = employeeCode.trim().toUpperCase();
        if (!cleanCode || cleanCode.length > 20) {
            throw createError('Mã nhân viên không hợp lệ (tối đa 20 ký tự)', 400, 'INVALID_EMPLOYEE_CODE');
        }
        const codeTaken = await userRepo.checkEmployeeCodeExists(cleanCode, targetUserId);
        if (codeTaken) {
            throw createError('Mã nhân viên này đã tồn tại trên hệ thống', 409, 'EMPLOYEE_CODE_EXISTS');
        }
        updateData.employeeCode = cleanCode;
    }

    return userRepo.updateStaffInfo(targetUserId, updateData);
};

const resetStaffPassword = async (targetUserId, { newPassword } = {}) => {
    //Kiểm tra người dùng có tồn tại và đúng là STAFF không
    const existingUser = await userRepo.getUserDetailById(targetUserId);
    if (!existingUser) {
        throw createError('Không tìm thấy nhân viên', 404, 'STAFF_NOT_FOUND');
    }
    if (existingUser.role !== 'STAFF') {
        throw createError('Chỉ được đặt lại mật khẩu cho tài khoản nhân viên (STAFF)', 400, 'NOT_A_STAFF');
    }

    //Validate mật khẩu mới
    if (!newPassword) {
        throw createError('Vui lòng nhập mật khẩu mới', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const cleanNewPass = newPassword.trim();
    if (cleanNewPass.length < 6 || cleanNewPass.length > 10) {
        throw createError('Mật khẩu mới phải có độ dài từ 6 đến 10 ký tự', 400, 'WEAK_PASSWORD');
    }

    //Kiểm tra mật khẩu mới không được trùng mật khẩu hiện tại trong DB
    const currentUser = await userRepo.getUserPasswordById(targetUserId);
    const isSame = await bcrypt.compare(cleanNewPass, currentUser.password);
    if (isSame) {
        throw createError('Mật khẩu mới không được trùng với mật khẩu hiện tại', 400, 'SAME_PASSWORD');
    }

    //Mã hóa và cập nhật vào bảng Users
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(cleanNewPass, salt);
    await userRepo.updateUserPassword(targetUserId, newPasswordHash);
};

module.exports = {
    getProfile,
    updateProfile,
    linkWallet,
    createStaffAccount,
    getStaffList,
    getUsers,
    getUserDetail,
    changeUserStatus,
    changeCustomerPassword,
    updateStaff,
    resetStaffPassword
};