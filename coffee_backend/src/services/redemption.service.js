const redemptionRepository = require("../repositories/redemption.repository");
const blockchainService = require("./blockchain.service");

function createError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

async function createRedemption(data) {
    if (!data.customerId) {
        throw createError("customerId là bắt buộc", "CUSTOMER_ID_REQUIRED");
    }
    if (!data.rewardId) {
        throw createError("rewardId là bắt buộc", "REWARD_ID_REQUIRED");
    }
    const result = await redemptionRepository.createRedemption(data);
    if (result.pendingTransactionId) {
        await blockchainService.processPendingTransaction(result.pendingTransactionId);
    }
    return await redemptionRepository.findRedemptionById(result.redemptionId);
}

async function getMyRedemptions(customerId) {
    if (!customerId) {
        throw createError(
            "customerId là bắt buộc",
            "CUSTOMER_ID_REQUIRED"
        );
    }
    return await redemptionRepository.findRedemptionsByCustomer(customerId);
}

// Nhân viên tra cứu bằng mã đổi quà
async function getRedemptionByCode(redemptionCode) {
    if (!redemptionCode) {
        throw createError(
            "redemptionCode là bắt buộc",
            "REDEMPTION_CODE_REQUIRED"
        );
    }
    const redemption =
        await redemptionRepository.findRedemptionByCode(redemptionCode);
    if (!redemption) {
        throw createError("Không tìm thấy phiếu đổi quà","REDEMPTION_NOT_FOUND");
    }
    return redemption;
}

async function deliverRedemption(redemptionId, staffId) {
    if (!redemptionId) {
        throw createError("redemptionId là bắt buộc","REDEMPTION_ID_REQUIRED");
    }
    if (!staffId) {
        throw createError("staffId là bắt buộc","STAFF_ID_REQUIRED");
    }
    return await redemptionRepository.deliverRedemption(
        redemptionId,
        staffId
    );
}

module.exports = {
    createRedemption,
    getMyRedemptions,
    getRedemptionByCode,
    deliverRedemption
};
