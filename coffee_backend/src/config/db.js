const sql = require('mssql');
const config = require('./env');

const dbConfig = {
    user: config.db.user,
    password: config.db.password,
    server: config.db.server,
    port: config.db.port,
    database: config.db.database,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
        console.log(`✅ Đã kết nối thành công tới SQL Server [${config.db.database}]`);
        return pool;
    })
    .catch((err) => {
        console.error('❌ Lỗi kết nối SQL Server:', err.message);
        process.exit(1);
    });

module.exports = {
    sql,
    poolPromise
};