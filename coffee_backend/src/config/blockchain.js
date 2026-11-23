const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const config = require('./env');

// Đọc file ABI an toàn (tránh crash app nếu chưa deploy Smart Contract)
const abiPath = path.join(__dirname, '../abi/LoyaltyPoint.json');
let contractABI = [];

if (fs.existsSync(abiPath)) {
    const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    contractABI = artifact.abi || artifact;
} else {
    console.warn('⚠️ Chưa tìm thấy file ABI tại src/abi/LoyaltyPoint.json. Hãy biên dịch Smart Contract trước!');
}

// Khởi tạo Provider kết nối tới mạng Blockchain
const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);

// Khởi tạo ví của hệ thống (dùng để ký giao dịch cộng/trừ điểm on-chain)
const backendWallet = new ethers.Wallet(config.blockchain.backendPrivateKey, provider);

// Khởi tạo đối tượng Smart Contract
const loyaltyContract = contractABI.length > 0 && config.blockchain.contractAddress
    ? new ethers.Contract(config.blockchain.contractAddress, contractABI, backendWallet)
    : null;

// Hàm kiểm tra kết nối Blockchain lúc khởi động server
const checkBlockchainConnection = async () => {
    try {
        const network = await provider.getNetwork();
        const balance = await provider.getBalance(backendWallet.address);
        console.log(`da ket noi toi blockchain [ChainID: ${network.chainId}]`);
        console.log(`vi he thong: ${backendWallet.address} | so du: ${ethers.formatEther(balance)} ETH`);
    } catch (error) {
        console.error('khong the ket noi toi blockchain:', error.message);
    }
};

module.exports = {
    ethers,
    provider,
    backendWallet,
    loyaltyContract,
    checkBlockchainConnection
};