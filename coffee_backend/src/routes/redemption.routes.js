const express = require("express");
const router = express.Router();

const redemptionController = require("../controllers/redemption.controller");
const {verifyToken,authorizeRoles} = require("../middlewares/auth.middleware");

// CUSTOMER: tạo yêu cầu đổi quà
router.post("/",verifyToken,authorizeRoles("CUSTOMER"),redemptionController.createRedemption);

// STAFF: tra cứu phiếu đổi quà theo mã
router.get("/code/:redemptionCode",verifyToken,authorizeRoles("STAFF"),redemptionController.getRedemptionByCode);

// STAFF: xác nhận giao quà
router.patch("/:id/deliver",verifyToken,authorizeRoles("STAFF"),redemptionController.deliverRedemption);

// CUSTOMER: xem lịch sử đổi quà của chính mình
router.get("/",verifyToken,authorizeRoles("CUSTOMER"),redemptionController.getMyRedemptions);

module.exports = router;