const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [[user]] = await db.execute(
      `SELECT id, name, username, role, email, whatsapp
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: String(user.role || '').toLowerCase().trim(),
      email: user.email || '',
      whatsapp: user.whatsapp || '',
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};
