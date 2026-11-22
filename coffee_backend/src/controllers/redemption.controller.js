const redemptionService = require("../services/redemption.service");

function handleError(res, error) {
    const statusMap = {
        CUSTOMER_ID_REQUIRED: 400,
        REWARD_ID_REQUIRED: 400,
        REDEMPTION_CODE_REQUIRED: 400,
        REDEMPTION_ID_REQUIRED: 400,
        STAFF_ID_REQUIRED: 400,

        CUSTOMER_NOT_FOUND: 404,
        REWARD_NOT_FOUND: 404,
        REDEMPTION_NOT_FOUND: 404,
        STAFF_NOT_FOUND: 404,

        REWARD_NOT_ACTIVE: 400,
        NOT_ENOUGH_POINT: 400,
        REWARD_OUT_OF_STOCK: 400,
        REDEMPTION_NOT_PENDING: 400,
        BLOCKCHAIN_TRANSACTION_NOT_CONFIRMED: 400
    };

    return res.status(statusMap[error.code] || 500).json({
        success: false,
        message: error.message || "Đã xảy ra lỗi",
        data: null,
        error: {
            code: error.code || "INTERNAL_SERVER_ERROR"
        }
    });
}

async function createRedemption(req, res) {
    try {
        const redemption = await redemptionService.createRedemption(req.body);
        return res.status(201).json({
            success: true,
            message: "Tạo yêu cầu đổi quà thành công",
            data: redemption,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getMyRedemptions(req, res) {
    try {
        const customerId = req.query.customerId;
        const redemptions =
            await redemptionService.getMyRedemptions(customerId);
        return res.status(200).json({
            success: true,
            message: "Lấy lịch sử đổi quà thành công",
            data: redemptions,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getRedemptionByCode(req, res) {
    try {
        const redemption = await redemptionService.getRedemptionByCode(
            req.params.redemptionCode
        );

        return res.status(200).json({
            success: true,
            message: "Tra cứu phiếu đổi quà thành công",
            data: redemption,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function deliverRedemption(req, res) {
    try {
        const redemption = await redemptionService.deliverRedemption(
            req.params.id,
            req.body.staffId
        );

        return res.status(200).json({
            success: true,
            message: "Xác nhận giao quà thành công",
            data: redemption,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    createRedemption,
    getMyRedemptions,
    getRedemptionByCode,
    deliverRedemption
};
