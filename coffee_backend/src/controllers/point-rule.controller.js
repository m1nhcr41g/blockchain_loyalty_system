const pointRuleService = require("../services/point-rule.service");

// GET /point-rules
async function getAllPointRules(req, res, next) {
    try {
        const { status } = req.query;
        const data = await pointRuleService.getAllPointRules(status);
        return res.status(200).json({
            success: true,
            message: status
                ? "Lấy lịch sử quy tắc tích điểm theo trạng thái thành công"
                : "Lấy toàn bộ lịch sử thay đổi quy tắc tích điểm thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// POST /point-rules
async function createPointRule(req, res, next) {
    try {
        const data = await pointRuleService.createPointRule(req.body);
        return res.status(201).json({
            success: true,
            message: "Tạo quy tắc tích điểm thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// PUT /point-rules/:id
async function updatePointRule(req, res, next) {
    try {
        const data = await pointRuleService.updatePointRule(
            req.params.id,
            req.body
        );
        return res.status(200).json({
            success: true,
            message: "Tạo phiên bản quy tắc tích điểm mới thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAllPointRules,
    createPointRule,
    updatePointRule
};
