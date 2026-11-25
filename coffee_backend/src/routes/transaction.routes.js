const express = require('express');
const router = express.Router();
const transactionController = require('../controller/transaction.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');
router.get('/', verifyToken, authorizeRoles('ADMIN', 'CUSTOMER'), transactionController.getTransactions);
router.get('/hash/:txHash', verifyToken, authorizeRoles('ADMIN'), transactionController.getTransactionsByHash);
router.get('/:id', verifyToken, authorizeRoles('ADMIN'), transactionController.getTransactionsById);
router.post('/:id/retry', verifyToken, authorizeRoles('ADMIN', 'STAFF'), transactionController.retryTransaction);
module.exports = router;