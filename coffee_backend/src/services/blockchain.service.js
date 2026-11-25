const { v4: uuidv4 } = require('uuid');
const { sql, poolPromise } = require('../config/db');
const { loyaltyContract, provider } = require('../config/blockchain');
const ApiError = require('../utils/ApiError');

const processPendingTransaction = async (transactionId) => {
    if (!loyaltyContract) {
        throw new ApiError(502, 'smart contract chua dc khoi tao tren server', 'BLOCKCHAIN_ERROR');
    }

    const pool = await poolPromise;
    const txRes = await pool
        .request().input('transactionId', sql.VarChar(36), transactionId).query(`
        SELECT pt.transactionId, pt.customerId, pt.invoiceId, pt.redemptionId,pt.type, pt.point, pt.status,c.walletAddress, c.totalPoint
        FROM PointTransactions pt
        INNER JOIN Customers c ON pt.customerId = c.userId
        WHERE pt.transactionId = @transactionId
        `);

    const txRecord = txRes.recordset[0];
    if (!txRecord) {
        throw new ApiError(404, 'ko tim thay giao dich diem', 'NOT_FOUND');
    }
    if (!txRecord.walletAddress) {
        await pool.request().input('transactionId', sql.VarChar(36), transactionId).query(`UPDATE PointTransactions SET status = 'FAILED' WHERE transactionId = @transactionId`);
        throw new ApiError(400, 'khach hang chua lien ket vi blockchain', 'WALLET_NOT_LINKED');
    }

    try {
        let tx;
        if (txRecord.type === 'EARN') {
            tx = await loyaltyContract.earnPoints(
                txRecord.walletAddress,
                txRecord.point,
                txRecord.invoiceId
            );
        } else {
            tx = await loyaltyContract.redeemPoints(
                txRecord.walletAddress,
                txRecord.point,
                txRecord.redemptionId
            );
        }

        const receipt = await tx.wait();
        const sqlTx = new sql.Transaction(pool);
        await sqlTx.begin();
        try {
            await new sql.Request(sqlTx).input('transactionId', sql.VarChar(36), transactionId).input('txHash', sql.VarChar(100), receipt.hash)
            .query(`UPDATE PointTransactions
            SET status = 'SUCCESS', txHash = @txHash
            WHERE transactionId = @transactionId`);

            const pointQuery =
            txRecord.type === 'EARN'? 'UPDATE Customers SET totalPoint = totalPoint + @point WHERE userId = @customerId': 'UPDATE Customers SET totalPoint = totalPoint - @point WHERE userId = @customerId';
            await new sql.Request(sqlTx)
            .input('customerId', sql.VarChar(36), txRecord.customerId)
            .input('point', sql.Int, txRecord.point)
            .query(pointQuery);
            await sqlTx.commit();
        } catch (updateErr) {
            await sqlTx.rollback();
            throw updateErr;
        }
        return {
            transactionId,
            invoiceId: txRecord.invoiceId,
            redemptionId: txRecord.redemptionId,
            type: txRecord.type,
            point: txRecord.point,
            txHash: receipt.hash,
            status: 'SUCCESS'
        };
    } catch (bcErr) {
        await pool.request().input('transactionId', sql.VarChar(36), transactionId).query(`UPDATE PointTransactions SET status = 'FAILED' WHERE transactionId = @transactionId`);
        throw new ApiError(
            502,
            `giao dich blockchain that bai: ${bcErr.reason || bcErr.message}`,
            'BLOCKCHAIN_ERROR'
        );
    }
};

const syncEarnPoints = async ({ customerId, invoiceId, point }) => {
    if (!loyaltyContract) {
        throw new ApiError(502, 'smart contract chua dc khoi tao tren server', 'BLOCKCHAIN_ERROR');
    }
    const pool = await poolPromise;
    const customerRes = await pool.request().input('customerId', sql.VarChar(36), customerId).query('SELECT userId, walletAddress, totalPoint FROM Customers WHERE userId = @customerId');
    const customer = customerRes.recordset[0];
    if (!customer) {
        throw new ApiError(404, 'khong tim thay thong tin cua khach hang', 'NOT_FOUND');
    }
    if (!customer.walletAddress) {
        throw new ApiError(400, 'khach hang chua lien ket voi vi blockchain nen ko the tich diem', 'WALLET_NOT_LINKED');
    }

    const transactionId = uuidv4();
    try {
        await pool.request().input('transactionId', sql.VarChar(36), transactionId).input('customerId', sql.VarChar(36), customerId)
        .input('invoiceId', sql.VarChar(36), invoiceId)
        .input('type', sql.VarChar(20), 'EARN')
        .input('point', sql.Int, point)
        .input('status', sql.VarChar(20), 'PENDING')
        .query(`INSERT INTO PointTransactions (transactionId, customerId, invoiceId, redemptionId, type, point, txHash, status)
        VALUES (@transactionId, @customerId, @invoiceId, NULL, @type, @point, NULL, @status)`);
    } catch (dbErr) {
        if (dbErr.number === 2601 || dbErr.number === 2627) {
            throw new ApiError(409, 'hoa don nay da dc gui yeu cau tich diem trc do', 'DUPLICATE_TRANSACTION');
        }
        throw dbErr;
    }

    return await processPendingTransaction(transactionId);
};

const syncRedeemPoints = async ({ customerId, redemptionId, point }) => {
    if (!loyaltyContract) {
        throw new ApiError(502, 'smart contract chua dc khoi tao tren server', 'BLOCKCHAIN_ERROR');
    }
    const pool = await poolPromise;
    const customerRes = await pool.request().input('customerId', sql.VarChar(36), customerId).query('SELECT userId, walletAddress, totalPoint FROM Customers WHERE userId = @customerId');
    const customer = customerRes.recordset[0];
    if (!customer) {
        throw new ApiError(404, 'khong tim thay thong tin khach hang', 'NOT_FOUND');
    }
    if (!customer.walletAddress) {
        throw new ApiError(400, 'khach hang chua lien ket vi blockchain', 'WALLET_NOT_LINKED');
    }
    if (customer.totalPoint < point) {
        throw new ApiError(400, 'khong du diem de doi qua', 'NOT_ENOUGH_POINT');
    }

    const transactionId = uuidv4();
    try {
        await pool
            .request().input('transactionId', sql.VarChar(36), transactionId).input('customerId', sql.VarChar(36), customerId).input('redemptionId', sql.VarChar(36), redemptionId)
            .input('type', sql.VarChar(20), 'REDEEM')
            .input('point', sql.Int, point)
            .input('status', sql.VarChar(20), 'PENDING')
            .query(`
            INSERT INTO PointTransactions (transactionId, customerId, invoiceId, redemptionId, type, point, txHash, status)
            VALUES (@transactionId, @customerId, NULL, @redemptionId, @type, @point, NULL, @status) `);
    } catch (dbErr) {
        if (dbErr.number === 2601 || dbErr.number === 2627) {
            throw new ApiError(409, 'phieu doi nay da dc xu li tru diem', 'DUPLICATE_TRANSACTION');
        }
        throw dbErr;
    }

    return await processPendingTransaction(transactionId);
};

const getTransactions = async ({ user, status, type, page = 1, limit = 10 }) => {
    const pool = await poolPromise;
    const request = pool.request();
    const countRequest = pool.request();
    const conditions = [];

    if (user.role === 'CUSTOMER') {
        conditions.push('pt.customerId = @customerId');
        request.input('customerId', sql.VarChar(36), user.userId);
        countRequest.input('customerId', sql.VarChar(36), user.userId);
    }
    if (status) {
        conditions.push('pt.status = @status');
        request.input('status', sql.VarChar(20), status.toUpperCase());
        countRequest.input('status', sql.VarChar(20), status.toUpperCase());
    }
    if (type) {
        conditions.push('pt.type = @type');
        request.input('type', sql.VarChar(20), type.toUpperCase());
        countRequest.input('type', sql.VarChar(20), type.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offSet = (Number(page) - 1) * Number(limit);
    request.input('offset', sql.Int, offSet);
    request.input('limit', sql.Int, Number(limit));

    const dataQuery = `SELECT pt.transactionId, pt.customerId, u.fullName AS customerName, u.email AS customerEmail,c.walletAddress, pt.invoiceId, pt.redemptionId, pt.type, pt.point, pt.txHash, pt.status, pt.createdAt
        FROM PointTransactions pt
        INNER JOIN Customers c ON pt.customerId = c.userId
        INNER JOIN Users u ON c.userId = u.userId
        ${whereClause}
        ORDER BY pt.createdAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const countQuery = ` SELECT COUNT(*) AS total FROM PointTransactions pt
        ${whereClause}
    `;

    const [dataRes, countRes] = await Promise.all([
        request.query(dataQuery),
        countRequest.query(countQuery)
    ]);

    const totalItems = countRes.recordset[0].total;
    return {
        items: dataRes.recordset,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            totalItems,
            totalPages: Math.ceil(totalItems / Number(limit))
        }
    };
};

const getTransactionsById = async (transactionId) => {
    const pool = await poolPromise;
    const res = await pool
        .request()
        .input('transactionId', sql.VarChar(36), transactionId)
        .query(`SELECT pt.*, u.fullName AS customerName, u.email AS customerEmail, c.walletAddress FROM PointTransactions pt
        INNER JOIN Customers c ON pt.customerId = c.userId
        INNER JOIN Users u ON c.userId = u.userId
        WHERE pt.transactionId = @transactionId
        `);
    const txRecord = res.recordset[0];
    if (!txRecord) {
        throw new ApiError(404, 'ko tim thay giao dich diem', 'NOT_FOUND');
    }
    return txRecord;
};

const getTransactionsByHash = async (txHash) => {
    const pool = await poolPromise;
    const res = await pool
        .request()
        .input('txHash', sql.VarChar(100), txHash)
        .query(`SELECT pt.*, u.fullName AS customerName, c.walletAddress
        FROM PointTransactions pt
        INNER JOIN Customers c ON pt.customerId = c.userId
        INNER JOIN Users u ON c.userId = u.userId
        WHERE pt.txHash = @txHash
        `);
    const dbRecord = res.recordset[0];
    if (!dbRecord) {
        throw new ApiError(404, 'ko tim thay giao dich voi txhash trong he thong', 'NOT_FOUND');
    }
    let onChainData = null;
    try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
            const block = await provider.getBlock(receipt.blockNumber);
            onChainData = {
                verifiedOnChain: receipt.status === 1,
                blockNumber: receipt.blockNumber,
                blockTimestamp: block ? new Date(block.timestamp * 1000).toISOString() : null,
                from: receipt.from,
                to: receipt.to,
                gasUsed: receipt.gasUsed.toString()
            };
        }
    } catch (err) {
        onChainData = { verifiedOnChain: false, error: err.message };
    }
    return {
        databaseRecord: dbRecord,
        blockchainVerification: onChainData
    };
};

const retryFailedTransaction = async (transactionId) => {
    const txRecord = await getTransactionsById(transactionId);
    if (txRecord.status !== 'FAILED') {
        throw new ApiError(
            400,
            `chi co the gui lai giao dich o trang thai FAILED (hiện tại: ${txRecord.status})`,
            'BAD_REQUEST'
        );
    }
    return await processPendingTransaction(transactionId);
};

module.exports = {processPendingTransaction,syncEarnPoints,syncRedeemPoints,getTransactions,getTransactionsById,getTransactionsByHash,retryFailedTransaction
};