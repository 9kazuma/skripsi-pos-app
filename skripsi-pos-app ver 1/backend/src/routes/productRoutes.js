const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/', authMiddleware, productController.getProducts);
router.get('/locations', authMiddleware, productController.getLocations);
router.get('/:id', authMiddleware, productController.getProductById);
router.post('/', authMiddleware, roleMiddleware('owner', 'manager'), productController.createProduct);
router.put('/:id', authMiddleware, roleMiddleware('owner', 'manager'), productController.updateProduct);
router.delete('/:id', authMiddleware, roleMiddleware('owner', 'manager'), productController.deleteProduct);

module.exports = router;
