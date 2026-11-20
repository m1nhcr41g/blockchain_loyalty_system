
const invoiceService = require("../services/invoice.service");

// POST /invoices
async function createInvoice(req, res, next) {
    try {
        const data = await invoiceService.createInvoice(req.body);

        return res.status(201).json({
            success: true,
            message: "Tạo hóa đơn thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// POST /invoices/:id/pay
async function payInvoice(req, res, next) {
    try {
        const data = await invoiceService.payInvoice(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Xác nhận thanh toán tiền mặt thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// PATCH /invoices/:id/cancel
async function cancelInvoice(req, res, next) {
    try {
        const data = await invoiceService.cancelInvoice(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Hủy hóa đơn thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// GET /invoices/:id
async function getInvoiceById(req, res, next) {
    try {
        const data = await invoiceService.getInvoiceById(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Lấy chi tiết hóa đơn thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// GET /invoices
async function getAllInvoices(req, res, next) {
    try {
        const filters = {
            status: req.query.status,
            customerId: req.query.customerId,
            fromDate: req.query.fromDate,
            toDate: req.query.toDate
        };

        const data = await invoiceService.getAllInvoices(filters);

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách hóa đơn thành công",
            data,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createInvoice,
    payInvoice,
    cancelInvoice,
    getInvoiceById,
    getAllInvoices
};
