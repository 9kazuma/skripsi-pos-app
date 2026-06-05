const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.post('/stock-in', roleMiddleware('owner', 'manager'), inventoryController.addStock);
router.post('/adjust', roleMiddleware('owner', 'manager'), inventoryController.adjustStock);

module.exports = router;
