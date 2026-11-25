const { sql, poolPromise } = require('../config/db');

// Tìm user theo email hoặc số điện thoại (do cả 2 đều UNIQUE trong bảng Users)
const findUserByEmailOrPhone = async (email, phone) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.VarChar(100), email)
        .input('phone', sql.VarChar(15), phone)
        .query(`
            SELECT userId, fullName, email, phone, password, role, status, createdAt
            FROM Users
            WHERE email = @email OR phone = @phone
        `);
    return result.recordset[0];
};

// Tạo tài khoản Customer (Users + Customers) bằng Transaction
const createCustomer = async ({ userId, fullName, email, phone, passwordHash }) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 1. Insert vào bảng Users
        const userReq = new sql.Request(transaction);
        const userResult = await userReq
            .input('userId', sql.VarChar(36), userId)
            .input('fullName', sql.NVarChar(100), fullName)
            .input('email', sql.VarChar(100), email)
            .input('phone', sql.VarChar(15), phone)
            .input('password', sql.VarChar(255), passwordHash)
            .input('role', sql.VarChar(20), 'CUSTOMER')
            .query(`
                INSERT INTO Users (userId, fullName, email, phone, password, role)
                OUTPUT INSERTED.userId, INSERTED.fullName, INSERTED.email, INSERTED.phone, INSERTED.role, INSERTED.status, INSERTED.createdAt
                VALUES (@userId, @fullName, @email, @phone, @password, @role)
            `);
        const newUser = userResult.recordset[0];

        // 2. Insert vào bảng Customers (walletAddress = NULL, totalPoint = 0)
        const custReq = new sql.Request(transaction);
        const custResult = await custReq
            .input('userId', sql.VarChar(36), userId)
            .query(`
                INSERT INTO Customers (userId, walletAddress, totalPoint)
                OUTPUT INSERTED.walletAddress, INSERTED.totalPoint
                VALUES (@userId, NULL, 0)
            `);
        const newCustomer = custResult.recordset[0];

        await transaction.commit();

        return {
            userId: newUser.userId,
            fullName: newUser.fullName,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            status: newUser.status,
            walletAddress: newCustomer.walletAddress,
            totalPoint: newCustomer.totalPoint,
            createdAt: newUser.createdAt
        };
    } catch (error) {
        if (!transaction._aborted) {
            await transaction.rollback();
        }
        throw error;
    }
};

module.exports = {
    findUserByEmailOrPhone,
    createCustomer
};