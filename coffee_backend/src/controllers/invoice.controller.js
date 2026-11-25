const invoiceService = require("../services/invoice.service");

function handleError(res, error) {
    const statusMap = {
        CUSTOMER_ID_REQUIRED: 400,
        STAFF_ID_REQUIRED: 400,
        ITEMS_REQUIRED: 400,
        PRODUCT_ID_REQUIRED: 400,
        INVALID_QUANTITY: 400,
        INVOICE_ID_REQUIRED: 400,
        INVALID_PAYMENT_STATUS: 400,
        INVALID_FROM_DATE: 400,
        INVALID_TO_DATE: 400,
        INVALID_DATE_RANGE: 400,

        CUSTOMER_NOT_FOUND: 404,
        STAFF_NOT_FOUND: 404,
        PRODUCT_NOT_AVAILABLE: 400,
        POINT_RULE_NOT_FOUND: 400,
        INVOICE_NOT_FOUND: 404,

        INVOICE_NOT_UNPAID: 400,
        INVOICE_CANNOT_BE_CANCELLED: 400
    };

    const status = statusMap[error.code] || 500;
    return res.status(status).json({
        success: false,
        message: error.message || "Đã xảy ra lỗi",
        data: null,
        error: {
            code: error.code || "INTERNAL_SERVER_ERROR"
        }
    });
}

// POST /invoices
async function createInvoice(req, res) {
    try {
        const invoice = await invoiceService.createInvoice({
            ...req.body,
            staffId: req.user.userId
        });
        return res.status(201).json({
            success: true,
            message: "Tạo hóa đơn thành công",
            data: invoice,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// POST /invoices/:id/pay
async function payInvoice(req, res) {
    try {
        const invoice = await invoiceService.payInvoice(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Xác nhận thanh toán hóa đơn thành công",
            data: invoice,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// PATCH /invoices/:id/cancel
async function cancelInvoice(req, res) {
    try {
        const invoice = await invoiceService.cancelInvoice(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Hủy hóa đơn thành công",
            data: invoice,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// GET /invoices/:id
async function getInvoiceById(req, res) {
    try {
        const invoice = await invoiceService.getInvoiceById(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Lấy thông tin hóa đơn thành công",
            data: invoice,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// GET /invoices
async function getAllInvoices(req, res) {
    try {
        const invoices = await invoiceService.getAllInvoices(req.query);

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách hóa đơn thành công",
            data: invoices,
            error: null
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    createInvoice,
    payInvoice,
    cancelInvoice,
    getInvoiceById,
    getAllInvoices
};
