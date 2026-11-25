const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice.controller");
const {verifyToken,authorizeRoles} = require("../middlewares/auth.middleware");

// Tất cả API Invoice chỉ STAFF được sử dụng
router.use(verifyToken, authorizeRoles("STAFF"));
// Tạo hóa đơn
router.post("/", invoiceController.createInvoice);
// Xác nhận thanh toán tiền mặt
router.post("/:id/pay", invoiceController.payInvoice);
// Hủy hóa đơn
router.patch("/:id/cancel", invoiceController.cancelInvoice);
// Xem chi tiết hóa đơn
router.get("/:id", invoiceController.getInvoiceById);
// Danh sách hóa đơn
router.get("/", invoiceController.getAllInvoices);

module.exports = router;


