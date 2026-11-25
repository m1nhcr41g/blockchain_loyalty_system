const express = require('express');
const router = express.Router();

const transactionRoutes = require('./transaction.routes');

router.use('/auth', require('./auth.route'));
router.use('/customers', require('./customer.route'));
router.use('/users', require('./user.route'));
router.use('/products', require('./product.route'));
router.use('/promotions', require('./promotion.route'));
router.use('/rewards', require('./reward.route'));
router.use('/transactions', transactionRoutes);
router.use('/point-rules', require('./point-rule.routes'));
router.use('/invoices', require('./invoice.routes'));
router.use('/redemptions', require('./redemption.routes'));

module.exports = router;