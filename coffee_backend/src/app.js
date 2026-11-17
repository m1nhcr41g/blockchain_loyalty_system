const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARES CƠ BẢN ====================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== ROUTES ====================

// Route mặc định
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Coffee Loyalty Blockchain API',
    version: 'v1'
  });
});

// Route kiểm tra trạng thái server (Health Check)
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Coffee Loyalty Blockchain API đang hoạt động!',
    data: null,
    error: null
  });
});


// const routes = require('./routes');
// app.use('/api/v1', routes);

// ==================== JSON SYNTAX ERROR HANDLER ====================
app.use((err, req, res, next) => {
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu JSON gửi lên không đúng định dạng cú pháp',
      data: null,
      error: {
        code: 'INVALID_JSON_BODY'
      }
    });
  }

  next(err);
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint API không tồn tại',
    data: null,
    error: {
      code: 'ENDPOINT_NOT_FOUND'
    }
  });
});

// ==================== GENERAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  if (!err.code) {
    switch (statusCode) {
      case 400: errorCode = 'BAD_REQUEST';
        break;
      case 401: errorCode = 'UNAUTHORIZED';
        break;
      case 403: errorCode = 'FORBIDDEN';
        break;
      case 404: errorCode = 'NOT_FOUND';
        break;
      case 409: errorCode = 'CONFLICT';
        break;
      case 500: errorCode = 'INTERNAL_SERVER_ERROR';
        break;
      case 502: errorCode = 'BLOCKCHAIN_ERROR';
        break;
      default:
        errorCode = 'UNKNOWN_ERROR';
    }
  }

  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Lỗi bên phía server',
    data: null,
    error: {
      code: errorCode
    }
  });
});

// ==================== START SERVER ====================
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại: http://localhost:${PORT}`);
  });
}

module.exports = app;