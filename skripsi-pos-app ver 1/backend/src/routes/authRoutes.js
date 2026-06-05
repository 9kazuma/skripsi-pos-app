const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/login', authController.login);
router.put('/profile', authMiddleware, authController.updateProfile);

// Backward-compatible user endpoints under /api/auth/users.
// Owner and manager can access user management, with owner protection enforced in the controller.
router.get('/users', authMiddleware, roleMiddleware('owner', 'manager'), authController.getUsers);
router.post('/users', authMiddleware, roleMiddleware('owner', 'manager'), authController.createUser);

module.exports = router;
