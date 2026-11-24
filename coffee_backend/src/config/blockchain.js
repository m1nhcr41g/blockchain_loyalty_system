const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const config = require('./env');
const abiPath = path.join(__dirname, '../abi/LoyaltyPoint.json');
let contractABI = [];

if (fs.existsSync(abiPath)) {
    const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    contractABI = artifact.abi || artifact;
} else {
    console.warn('chua tim thay file abi!');
}
const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
const backendWallet = new ethers.Wallet(config.blockchain.backendPrivateKey, provider);
const loyaltyContract = contractABI.length > 0 && config.blockchain.contractAddress
    ? new ethers.Contract(config.blockchain.contractAddress, contractABI, backendWallet)
    : null;
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