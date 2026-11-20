
const { sql, poolPromise } = require("../config/db");

// Lấy danh sách quy tắc tích điểm
async function findAll({ status } = {}) {
    const pool = await poolPromise;
    const request = pool.request();

    let query = `
        SELECT
            ruleId,
            previousRuleId,
            ruleName,
            pointRate,
            minimumAmount,
            startDate,
            endDate,
            status
        FROM PointRules
        WHERE 1 = 1
    `;

    if (status) {
        query += ` AND status = @status`;
        request.input("status", sql.VarChar(20), status);
    }

    query += ` ORDER BY startDate DESC`;

    const result = await request.query(query);
    return result.recordset;
}

// Tìm quy tắc theo ID
async function findById(ruleId) {
    const pool = await poolPromise;

    const result = await pool.request()
        .input("ruleId", sql.VarChar(36), ruleId)
        .query(`
            SELECT
                ruleId,
                previousRuleId,
                ruleName,
                pointRate,
                minimumAmount,
                startDate,
                endDate,
                status
            FROM PointRules
            WHERE ruleId = @ruleId
        `);

    return result.recordset[0] || null;
}

// Tạo phiên bản quy tắc mới
async function createVersion(data, previousRuleId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        const request = new sql.Request(transaction);

        // Khóa các quy tắc ACTIVE để tránh hai request
        // cùng lúc tạo ra nhiều quy tắc mới.
        const activeResult = await request.query(`
            SELECT ruleId
            FROM PointRules WITH (UPDLOCK, HOLDLOCK)
            WHERE status = 'ACTIVE'
        `);

        const activeRules = activeResult.recordset;

        if (previousRuleId) {
            const previousRule = activeRules.find(
                rule => rule.ruleId === previousRuleId
            );

            if (!previousRule) {
                const error = new Error(
                    "Quy tắc cần cập nhật không tồn tại hoặc không còn ACTIVE"
                );
                error.statusCode = 409;
                error.code = "POINT_RULE_NOT_ACTIVE";
                throw error;
            }
        }

        const oldRuleId = previousRuleId || activeRules[0]?.ruleId || null;

        // Đóng các quy tắc ACTIVE cũ.
        if (activeRules.length > 0) {
            await new sql.Request(transaction).query(`
                UPDATE PointRules
                SET
                    status = 'INACTIVE',
                    endDate = GETDATE()
                WHERE status = 'ACTIVE'
            `);
        }

        const newRuleId = require("crypto").randomUUID();

        const insertRequest = new sql.Request(transaction);

        insertRequest
            .input("ruleId", sql.VarChar(36), newRuleId)
            .input("previousRuleId", sql.VarChar(36), oldRuleId)
            .input("ruleName", sql.NVarChar(100), data.ruleName)
            .input("pointRate", sql.Decimal(10, 2), data.pointRate)
            .input("minimumAmount", sql.Decimal(18, 2), data.minimumAmount)
            .input("startDate", sql.DateTime, data.startDate);

        await insertRequest.query(`
            INSERT INTO PointRules (
                ruleId,
                previousRuleId,
                ruleName,
                pointRate,
                minimumAmount,
                startDate,
                endDate,
                status
            )
            VALUES (
                @ruleId,
                @previousRuleId,
                @ruleName,
                @pointRate,
                @minimumAmount,
                @startDate,
                NULL,
                'ACTIVE'
            )
        `);

        await transaction.commit();

        return await findById(newRuleId);
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {}

        throw error;
    }
}

module.exports = {
    findAll,
    findById,
    createVersion
};
