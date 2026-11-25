const invoiceRepository = require("../repositories/invoice.repository");

function createError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

async function createInvoice(data) {
    if (!data.customerId) {
        throw createError("customerId là bắt buộc", "CUSTOMER_ID_REQUIRED");
    }
    if (!data.staffId) {
        throw createError("Không xác định được nhân viên đăng nhập", "STAFF_ID_REQUIRED");
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw createError("Hóa đơn phải có ít nhất một sản phẩm", "ITEMS_REQUIRED");
    }
    for (const item of data.items) {
        if (!item.productId) {
            throw createError("productId là bắt buộc", "PRODUCT_ID_REQUIRED");
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
            throw createError(
                "quantity phải là số nguyên lớn hơn 0",
                "INVALID_QUANTITY"
            );
        }
    }
    return await invoiceRepository.createInvoice(data);
}

async function payInvoice(invoiceId) {
    if (!invoiceId) {
        throw createError("invoiceId là bắt buộc", "INVOICE_ID_REQUIRED");
    }

    return await invoiceRepository.payInvoice(invoiceId);
}

async function cancelInvoice(invoiceId) {
    if (!invoiceId) {
        throw createError("invoiceId là bắt buộc", "INVOICE_ID_REQUIRED");
    }

    return await invoiceRepository.cancelInvoice(invoiceId);
}

async function getInvoiceById(invoiceId) {
    if (!invoiceId) {
        throw createError("invoiceId là bắt buộc", "INVOICE_ID_REQUIRED");
    }
    const invoice = await invoiceRepository.findInvoiceById(invoiceId);
    if (!invoice) {
        throw createError("Không tìm thấy hóa đơn", "INVOICE_NOT_FOUND");
    }

    return invoice;
}

async function getAllInvoices(filters) {
    const allowedStatuses = ["PAID", "UNPAID", "CANCELLED"];

    if (
        filters.paymentStatus &&
        !allowedStatuses.includes(filters.paymentStatus)
    ) {
        throw createError(
            "paymentStatus không hợp lệ",
            "INVALID_PAYMENT_STATUS"
        );
    }

    if (
        filters.fromDate &&
        Number.isNaN(Date.parse(filters.fromDate))
    ) {
        throw createError("fromDate không hợp lệ", "INVALID_FROM_DATE");
    }

    if (
        filters.toDate &&
        Number.isNaN(Date.parse(filters.toDate))
    ) {
        throw createError("toDate không hợp lệ", "INVALID_TO_DATE");
    }

    if (
        filters.fromDate &&
        filters.toDate &&
        new Date(filters.fromDate) > new Date(filters.toDate)
    ) {
        throw createError(
            "fromDate không được lớn hơn toDate",
            "INVALID_DATE_RANGE"
        );
    }

    return await invoiceRepository.findAllInvoices(filters);
}

module.exports = {
    createInvoice,
    payInvoice,
    cancelInvoice,
    getInvoiceById,
    getAllInvoices
};
