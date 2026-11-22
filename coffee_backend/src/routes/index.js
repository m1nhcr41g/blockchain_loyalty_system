const express = require('express');
const router = express.Router();

router.use('/promotions', require('./promotion.routes'));
router.use('/point-rules', require('./point-rule.routes'));
router.use('/invoices', require('./invoice.routes'));
router.use('/redemptions', require('./redemption.routes'));

module.exports = router;