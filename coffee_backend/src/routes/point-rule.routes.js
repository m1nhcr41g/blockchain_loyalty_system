const express = require("express");
const router = express.Router();
const pointRuleController = require("../controllers/point-rule.controller");
const {verifyToken,authorizeRoles} = require("../middlewares/auth.middleware");

// Tất cả API Point Rule chỉ ADMIN được sử dụng
router.use(verifyToken, authorizeRoles("ADMIN"));
// GET /api/v1/point-rules
router.get("/", pointRuleController.getAllPointRules);
// POST /api/v1/point-rules
router.post("/", pointRuleController.createPointRule);
// PUT /api/v1/point-rules/:id
router.put("/:id", pointRuleController.updatePointRule);

module.exports = router;
