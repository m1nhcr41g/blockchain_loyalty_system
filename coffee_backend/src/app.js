const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const { poolPromise } = require('./config/db');
const { checkBlockchainConnection } = require('./config/blockchain');

const app = express();
const path = require('path');
// ==================== MIDDLEWARES CƠ BẢN ====================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Cho phép trình duyệt/Frontend truy cập ảnh qua đường link http://localhost:5000/uploads/...
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==================== ROUTES ====================

// Route mặc định
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Coffee Loyalty Blockchain API',
    version: 'v1'
  });
});

// Route kiểm tra trạng thái server & kết nối Database (Health Check)
app.get('/api/v1/health', async (req, res, next) => {
  try {
    const pool = await poolPromise;
    await pool.request().query('SELECT 1 AS ok');

    res.status(200).json({
      success: true,
      message: 'Coffee Loyalty Blockchain API & SQL Server đang hoạt động!',
      data: {
        database: 'CONNECTED',
        timestamp: new Date().toISOString()
      },
      error: null
    });
  } catch (err) {
    next(err);
  }
});

const routes = require('./routes');
app.use('/api/v1', routes);


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
      case 400:
        errorCode = 'BAD_REQUEST';
        break;
      case 401:
        errorCode = 'UNAUTHORIZED';
        break;
      case 403:
        errorCode = 'FORBIDDEN';
        break;
      case 404:
        errorCode = 'NOT_FOUND';
        break;
      case 409:
        errorCode = 'CONFLICT';
        break;
      case 500:
        errorCode = 'INTERNAL_SERVER_ERROR';
        break;
      case 502:
        errorCode = 'BLOCKCHAIN_ERROR';
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
  const startServer = async () => {
    try {
      await poolPromise;
      await checkBlockchainConnection();

      app.listen(config.port, () => {
        console.log(`Server đang chạy tại: http://localhost:${config.port}`);
      });
    } catch (err) {
      console.error('Khởi động server thất bại:', err.message);
      process.exit(1);
    }
  };

  startServer();
}

module.exports = app;