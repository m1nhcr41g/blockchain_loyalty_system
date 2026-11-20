
const invoiceRepository = require("../repositories/invoice.repository");

function createError(message, statusCode, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

// Kiểm tra dữ liệu tạo hóa đơn
function validateCreateInvoice(data) {
    if (!data.customerId) {
        throw createError(
            "Vui lòng cung cấp mã khách hàng",
            400,
            "CUSTOMER_ID_REQUIRED"
        );
    }

    if (!data.staffId) {
        throw createError(
            "Vui lòng cung cấp mã nhân viên",
            400,
            "STAFF_ID_REQUIRED"
        );
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw createError(
            "Hóa đơn phải có ít nhất một sản phẩm",
            400,
            "INVOICE_ITEMS_REQUIRED"
        );
    }

    for (const item of data.items) {
        if (!item.productId) {
            throw createError(
                "Thiếu mã sản phẩm",
                400,
                "PRODUCT_ID_REQUIRED"
            );
        }

        if (
            !Number.isInteger(item.quantity) ||
            item.quantity <= 0
        ) {
            throw createError(
                "Số lượng sản phẩm phải là số nguyên lớn hơn 0",
                400,
                "INVALID_QUANTITY"
            );
        }
    }
}

// Tạo hóa đơn
async function createInvoice(data) {
    validateCreateInvoice(data);
    return await invoiceRepository.createInvoice(data);
}

// Xác nhận thanh toán
async function payInvoice(invoiceId) {
    if (!invoiceId) {
        throw createError(
            "Thiếu mã hóa đơn",
            400,
            "INVOICE_ID_REQUIRED"
        );
    }

    return await invoiceRepository.payInvoice(invoiceId);
}

// Hủy hóa đơn
async function cancelInvoice(invoiceId) {
    if (!invoiceId) {
        throw createError(
            "Thiếu mã hóa đơn",
            400,
            "INVOICE_ID_REQUIRED"
        );
    }

    return await invoiceRepository.cancelInvoice(invoiceId);
}

// Xem chi tiết
async function getInvoiceById(invoiceId) {
    const invoice = await invoiceRepository.findInvoiceById(invoiceId);

    if (!invoice) {
        throw createError(
            "Không tìm thấy hóa đơn",
            404,
            "INVOICE_NOT_FOUND"
        );
    }

    return invoice;
}

// Danh sách hóa đơn
async function getAllInvoices(filters) {
    const allowedStatuses = ["PAID", "UNPAID", "CANCELLED"];

    if (
        filters.status &&
        !allowedStatuses.includes(filters.status)
    ) {
        throw createError(
            "Trạng thái hóa đơn không hợp lệ",
            400,
            "INVALID_PAYMENT_STATUS"
        );
    }

    for (const field of ["fromDate", "toDate"]) {
        if (
            filters[field] &&
            Number.isNaN(new Date(filters[field]).getTime())
        ) {
            throw createError(
                `Ngày ${field} không hợp lệ`,
                400,
                "INVALID_DATE_FILTER"
            );
        }
    }

    if (
        filters.fromDate &&
        filters.toDate &&
        new Date(filters.fromDate) > new Date(filters.toDate)
    ) {
        throw createError(
            "Ngày bắt đầu không được lớn hơn ngày kết thúc",
            400,
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
