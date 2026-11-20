
const pointRuleRepository = require("../repositories/point-rule.repository");

function createError(message, statusCode, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

// Lấy danh sách quy tắc
async function getAllPointRules(status) {
    if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
        throw createError(
            "Trạng thái quy tắc không hợp lệ",
            400,
            "INVALID_POINT_RULE_STATUS"
        );
    }

    return await pointRuleRepository.findAll({ status });
}

// Tạo mới phiên bản quy tắc
async function createPointRule(data) {
    validatePointRule(data);

    const startDate = data.startDate
        ? new Date(data.startDate)
        : new Date();

    if (Number.isNaN(startDate.getTime())) {
        throw createError(
            "Ngày bắt đầu không hợp lệ",
            400,
            "INVALID_START_DATE"
        );
    }

    return await pointRuleRepository.createVersion({
        ruleName: data.ruleName.trim(),
        pointRate: Number(data.pointRate),
        minimumAmount: Number(data.minimumAmount ?? 0),
        startDate
    });
}

// Cập nhật bằng cách tạo phiên bản mới
async function updatePointRule(ruleId, data) {
    if (!ruleId) {
        throw createError(
            "Thiếu mã quy tắc tích điểm",
            400,
            "RULE_ID_REQUIRED"
        );
    }

    const oldRule = await pointRuleRepository.findById(ruleId);

    if (!oldRule) {
        throw createError(
            "Không tìm thấy quy tắc tích điểm",
            404,
            "POINT_RULE_NOT_FOUND"
        );
    }

    if (oldRule.status !== "ACTIVE") {
        throw createError(
            "Chỉ được tạo phiên bản mới từ quy tắc đang ACTIVE",
            409,
            "POINT_RULE_NOT_ACTIVE"
        );
    }

    const mergedData = {
        ruleName: data.ruleName ?? oldRule.ruleName,
        pointRate: data.pointRate ?? oldRule.pointRate,
        minimumAmount: data.minimumAmount ?? oldRule.minimumAmount,
        startDate: data.startDate ?? new Date()
    };

    validatePointRule(mergedData);

    const startDate = new Date(mergedData.startDate);

    if (Number.isNaN(startDate.getTime())) {
        throw createError(
            "Ngày bắt đầu không hợp lệ",
            400,
            "INVALID_START_DATE"
        );
    }

    return await pointRuleRepository.createVersion({
        ruleName: String(mergedData.ruleName).trim(),
        pointRate: Number(mergedData.pointRate),
        minimumAmount: Number(mergedData.minimumAmount),
        startDate
    }, ruleId);
}

// Kiểm tra dữ liệu đầu vào
function validatePointRule(data) {
    if (
        typeof data.ruleName !== "string" ||
        !data.ruleName.trim()
    ) {
        throw createError(
            "Tên quy tắc không được để trống",
            400,
            "RULE_NAME_REQUIRED"
        );
    }

    if (data.ruleName.trim().length > 100) {
        throw createError(
            "Tên quy tắc không được vượt quá 100 ký tự",
            400,
            "RULE_NAME_TOO_LONG"
        );
    }

    if (
        data.pointRate === undefined ||
        data.pointRate === null ||
        data.pointRate === "" ||
        !Number.isFinite(Number(data.pointRate)) ||
        Number(data.pointRate) <= 0
    ) {
        throw createError(
            "Tỷ lệ tích điểm phải lớn hơn 0",
            400,
            "INVALID_POINT_RATE"
        );
    }

    const minimumAmount = data.minimumAmount ?? 0;

    if (
        minimumAmount === "" ||
        !Number.isFinite(Number(minimumAmount)) ||
        Number(minimumAmount) < 0
    ) {
        throw createError(
            "Giá trị hóa đơn tối thiểu không hợp lệ",
            400,
            "INVALID_MINIMUM_AMOUNT"
        );
    }
}

module.exports = {
    getAllPointRules,
    createPointRule,
    updatePointRule
};
