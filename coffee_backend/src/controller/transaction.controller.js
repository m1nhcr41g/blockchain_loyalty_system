const blockchainService = require('../services/blockchain.service');
const getTransactions  = async(req,res,next)=>{
    try {
        const {status, type, page, limit} = req.query;
        const result = await blockchainService.getTransactions({
            user: req.user,
            status,
            type,
            page,
            limit
        });
        res.status(200).json({success:true, message: 'lay danh sach giao dich diem thanh cong',data:result,error:null});
    } catch (err) {
        next(err);
    }
};

const getTransactionsById = async(req,res,next)=>{
    try {
        const data = await blockchainService.getTransactionsById(req.params.id);
            res.status(200).json({success:true, message: 'lay chi tiet giao dich thanh cong',data,error:null});
    } catch (err) {
        next(err);
    }
};

const getTransactionsByHash = async(req,res,next)=>{
    try {
        const data = await blockchainService.getTransactionsByHash(req.params.txHash);
        res.status(200).json({success:true, message:'doi soat giao dich blockchain thanh cong',data, error:null});
    } catch (err) {
        next(err);
    }
};

const retryTransaction = async(req,res,next)=>{
    try {
        const data = await blockchainService.retryFailedTransaction(req.params.id);
        res.status(200).json({success: true, message:'gui lai giao dich thanh cong',data,error:null});
    } catch (err) {
        next(err);
    }
};

module.exports={getTransactions,getTransactionsById,getTransactionsByHash,retryTransaction};