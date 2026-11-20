const express = require("express");
const router = express.Router();

const promotionController = require("../controllers/promotion.controller");

// GET /api/v1/promotions
router.get("/", promotionController.getAll);

// POST /api/v1/promotions
router.post("/", promotionController.create);

// PUT /api/v1/promotions/:id
router.put("/:id", promotionController.update);

// PATCH /api/v1/promotions/:id/status
router.patch("/:id/status", promotionController.updateStatus);

module.exports = router;
