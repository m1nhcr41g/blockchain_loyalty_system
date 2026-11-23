require('dotenv').config();

const requiredEnvVars = [
    'DB_SERVER',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'RPC_URL',
    'CONTRACT_ADDRESS',
    'BACKEND_PRIVATE_KEY'
];

const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
    console.warn(`thieu bien moi truong trong env: ${missingVars.join(', ')}`);
}

module.exports = {
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    db: {
        server: process.env.DB_SERVER || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 1433,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'CoffeeBlockchainDB',
    },
    blockchain: {
        rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
        chainId: parseInt(process.env.CHAIN_ID, 10) || 31337,
        contractAddress: process.env.CONTRACT_ADDRESS,
        backendPrivateKey: process.env.BACKEND_PRIVATE_KEY,
    }
};