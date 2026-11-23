const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.route'));
router.use('/customers', require('./customer.route'));
router.use('/users', require('./user.route'));
router.use('/products', require('./product.route'));
router.use ('/promotions',require('./promotion.route'));
router.use('/rewards', require('./reward.route'));

module.exports = router;