const express = require('express');
const router = express.Router();
const controller = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Dashboard is available to owner and manager.
router.get('/dashboard', roleMiddleware('owner', 'manager'), controller.dashboard);

// Full reports and sales target management are owner-only.
router.get('/cashiers', roleMiddleware('owner'), controller.getCashiers);
router.get('/sales-summary', roleMiddleware('owner'), controller.salesSummary);
router.get('/cashier-summary', roleMiddleware('owner'), controller.cashierSummary);
router.get('/targets/current', roleMiddleware('owner'), controller.getCurrentTarget);
router.post('/targets', roleMiddleware('owner'), controller.setAnnualTarget);

module.exports = router;
