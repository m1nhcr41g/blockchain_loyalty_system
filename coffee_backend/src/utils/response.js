const sendSuccess = (res, message = 'Thực hiện thành công', data = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        error: null
    });
};

// Tạo đối tượng lỗi khớp với General Error Handler trong app.js
const createError = (message, statusCode = 400, code = 'BAD_REQUEST') => {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
};

module.exports = { sendSuccess, createError };