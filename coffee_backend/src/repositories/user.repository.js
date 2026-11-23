const { sql, poolPromise } = require('../config/db');

// --- CUSTOMER ---
const getCustomerProfile = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.VarChar(36), userId)
        .query(`
            SELECT u.userId, u.fullName, u.email, u.phone, u.role, u.status, u.createdAt,
                   c.walletAddress, c.totalPoint
            FROM Users u
            INNER JOIN Customers c ON u.userId = c.userId
            WHERE u.userId = @userId
        `);
    return result.recordset[0];
};

const checkPhoneExists = async (phone, excludeUserId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('phone', sql.VarChar(15), phone)
        .input('userId', sql.VarChar(36), excludeUserId)
        .query('SELECT userId FROM Users WHERE phone = @phone AND userId != @userId');
    return result.recordset.length > 0;
};

const updateCustomerProfile = async (userId, { fullName, phone }) => {
    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.VarChar(36), userId)
        .input('fullName', sql.NVarChar(100), fullName || null)
        .input('phone', sql.VarChar(15), phone || null)
        .query(`
            UPDATE Users
            SET fullName = COALESCE(@fullName, fullName),
                phone = COALESCE(@phone, phone)
            WHERE userId = @userId
        `);
    return getCustomerProfile(userId);
};

const checkWalletExists = async (walletAddress, excludeUserId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('walletAddress', sql.VarChar(100), walletAddress)
        .input('userId', sql.VarChar(36), excludeUserId)
        .query('SELECT userId FROM Customers WHERE walletAddress = @walletAddress AND userId != @userId');
    return result.recordset.length > 0;
};

const updateCustomerWallet = async (userId, walletAddress) => {
    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.VarChar(36), userId)
        .input('walletAddress', sql.VarChar(100), walletAddress)
        .query('UPDATE Customers SET walletAddress = @walletAddress WHERE userId = @userId');
    return getCustomerProfile(userId);
};

// --- STAFF (ADMIN) ---
const checkEmployeeCodeExists = async (employeeCode) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('employeeCode', sql.VarChar(20), employeeCode)
        .query('SELECT userId FROM Staffs WHERE employeeCode = @employeeCode');
    return result.recordset.length > 0;
};

const createStaff = async ({ userId, fullName, email, phone, passwordHash, employeeCode }) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const userReq = new sql.Request(transaction);
        const userResult = await userReq
            .input('userId', sql.VarChar(36), userId)
            .input('fullName', sql.NVarChar(100), fullName)
            .input('email', sql.VarChar(100), email)
            .input('phone', sql.VarChar(15), phone)
            .input('password', sql.VarChar(255), passwordHash)
            .input('role', sql.VarChar(20), 'STAFF')
            .query(`
                INSERT INTO Users (userId, fullName, email, phone, password, role)
                OUTPUT INSERTED.userId, INSERTED.fullName, INSERTED.email, INSERTED.phone, INSERTED.role, INSERTED.status, INSERTED.createdAt
                VALUES (@userId, @fullName, @email, @phone, @password, @role)
            `);
        const newUser = userResult.recordset[0];

        const staffReq = new sql.Request(transaction);
        await staffReq
            .input('userId', sql.VarChar(36), userId)
            .input('employeeCode', sql.VarChar(20), employeeCode)
            .query(`
                INSERT INTO Staffs (userId, employeeCode)
                VALUES (@userId, @employeeCode)
            `);

        await transaction.commit();

        return {
            ...newUser,
            employeeCode
        };
    } catch (error) {
        try {
            await transaction.rollback();
        }catch(_){

        }
        throw error;
    }
};

const getAllStaffs = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT u.userId, u.fullName, u.email, u.phone, u.role, u.status, u.createdAt,
               s.employeeCode
        FROM Users u
        INNER JOIN Staffs s ON u.userId = s.userId
        ORDER BY u.createdAt DESC
    `);
    return result.recordset;
};


// Lấy danh sách người dùng (có hỗ trợ tìm kiếm theo tên/email/SĐT và lọc theo role/status)
const getAllUsers = async ({ search, role, status, page = 1, limit = 10 }) => {
    const pool = await poolPromise;

    // 1. Tạo điều kiện WHERE dùng chung cho cả query đếm tổng và query lấy dữ liệu
    let whereClause = 'WHERE 1=1';
    if (search) {
        whereClause += ` AND (u.fullName LIKE @search OR u.email LIKE @search OR u.phone LIKE @search OR s.employeeCode LIKE @search)`;
    }
    if (role) {
        whereClause += ` AND u.role = @role`;
    }
    if (status) {
        whereClause += ` AND u.status = @status`;
    }

    // Hàm gắn tham số đầu vào
    const bindInputs = (req) => {
        if (search) req.input('search', sql.NVarChar(100), `%${search}%`);
        if (role) req.input('role', sql.VarChar(20), role);
        if (status) req.input('status', sql.VarChar(20), status);
        return req;
    };

    // 2. Đếm tổng số bản ghi khớp điều kiện lọc
    const countQuery = `
        SELECT COUNT(*) AS totalItems
        FROM Users u
        LEFT JOIN Customers c ON u.userId = c.userId
        LEFT JOIN Staffs s ON u.userId = s.userId
        ${whereClause}
    `;
    const countResult = await bindInputs(pool.request()).query(countQuery);
    const totalItems = countResult.recordset[0].totalItems;

    // 3. Lấy danh sách bản ghi theo trang (OFFSET - FETCH của SQL Server)
    const offset = (page - 1) * limit;
    const dataQuery = `
        SELECT u.userId, u.fullName, u.email, u.phone, u.role, u.status, u.createdAt,
               c.walletAddress, c.totalPoint,
               s.employeeCode
        FROM Users u
        LEFT JOIN Customers c ON u.userId = c.userId
        LEFT JOIN Staffs s ON u.userId = s.userId
        ${whereClause}
        ORDER BY u.createdAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const dataReq = bindInputs(pool.request())
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limit);

    const dataResult = await dataReq.query(dataQuery);

    return {
        items: dataResult.recordset,
        pagination: {
            page,
            limit,
            totalItems,
            totalPages: Math.ceil(totalItems / limit)
        }
    };
};

// Xem chi tiết 1 người dùng theo userId
const getUserDetailById = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.VarChar(36), userId)
        .query(`
            SELECT u.userId, u.fullName, u.email, u.phone, u.role, u.status, u.createdAt,
                   c.walletAddress, c.totalPoint,
                   s.employeeCode
            FROM Users u
            LEFT JOIN Customers c ON u.userId = c.userId
            LEFT JOIN Staffs s ON u.userId = s.userId
            WHERE u.userId = @userId
        `);
    return result.recordset[0];
};

// Cập nhật trạng thái ACTIVE / INACTIVE
const updateUserStatus = async (userId, status) => {
    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.VarChar(36), userId)
        .input('status', sql.VarChar(20), status)
        .query('UPDATE Users SET status = @status WHERE userId = @userId');
    return getUserDetailById(userId);
};

// Lấy mật khẩu hiện tại (đã hash) của user theo userId
const getUserPasswordById = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.VarChar(36), userId)
        .query('SELECT userId, password FROM Users WHERE userId = @userId');
    return result.recordset[0];
};

// Cập nhật mật khẩu mới vào bảng Users
const updateUserPassword = async (userId, newPasswordHash) => {
    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.VarChar(36), userId)
        .input('password', sql.VarChar(255), newPasswordHash)
        .query('UPDATE Users SET password = @password WHERE userId = @userId');
};

const checkEmployeeCodeExistsForOtherUser = async (employeeCode, excludeUserId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('employeeCode', sql.VarChar(20), employeeCode)
        .input('userId', sql.VarChar(36), excludeUserId)
        .query('SELECT userId FROM Staffs WHERE employeeCode = @employeeCode AND userId != @userId');
    return result.recordset.length > 0;
};

const updateStaffInfo = async (userId, { fullName, phone, employeeCode }) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const userUpdates = [];
        const userReq = new sql.Request(transaction).input('userId', sql.VarChar(36), userId);

        if (fullName !== undefined) {
            userUpdates.push('fullName = @fullName');
            userReq.input('fullName', sql.NVarChar(100), fullName);
        }
        if (phone !== undefined) {
            userUpdates.push('phone = @phone');
            userReq.input('phone', sql.VarChar(15), phone);
        }

        if (userUpdates.length > 0) {
            await userReq.query(`UPDATE Users SET ${userUpdates.join(', ')} WHERE userId = @userId`);
        }

        if (employeeCode !== undefined) {
            await new sql.Request(transaction)
                .input('userId', sql.VarChar(36), userId)
                .input('employeeCode', sql.VarChar(20), employeeCode)
                .query('UPDATE Staffs SET employeeCode = @employeeCode WHERE userId = @userId');
        }

        await transaction.commit();

        return getUserDetailById(userId);
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {}
        throw error;
    }
};
module.exports = {
    getCustomerProfile,
    checkPhoneExists,
    updateCustomerProfile,
    checkWalletExists,
    updateCustomerWallet,
    checkEmployeeCodeExists,
    createStaff,
    getAllStaffs,
    getAllUsers,
    getUserDetailById,
    updateUserStatus,
    getUserPasswordById,
    updateUserPassword,
    checkEmployeeCodeExistsForOtherUser,
    updateStaffInfo
};