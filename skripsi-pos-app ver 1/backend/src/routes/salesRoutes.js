const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', salesController.createSale);
router.get('/', salesController.getSalesHistory);
router.get('/:id', salesController.getSaleDetail);

module.exports = router;