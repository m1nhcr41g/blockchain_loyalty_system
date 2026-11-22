const express = require("express");
const router = express.Router();
const redemptionController = require("../controllers/redemption.controller");

router.post("/", redemptionController.createRedemption);
router.get("/code/:redemptionCode",redemptionController.getRedemptionByCode);
router.patch("/:id/deliver",redemptionController.deliverRedemption);
router.get("/", redemptionController.getMyRedemptions);

module.exports = router;
