const express = require("express");
const router = express.Router();
const redemptionController = require("../controllers/redemption.controller");

// Tạo yêu cầu đổi quà
router.post("/", redemptionController.createRedemption);
// Tra cứu phiếu đổi quà theo mã
router.get("/code/:redemptionCode",redemptionController.getRedemptionByCode);
// Xác nhận giao quà
router.patch("/:id/deliver",redemptionController.deliverRedemption);
// Xem lịch sử đổi quà của khách hàng
router.get("/", redemptionController.getMyRedemptions);

module.exports = router;
