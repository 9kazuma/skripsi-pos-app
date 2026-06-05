const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.loginUser = async (username, password) => {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE username = ? LIMIT 1',
    [username]
  );

  if (rows.length === 0) {
    throw new Error('Invalid username or password');
  }

  const user = rows[0];
  const isMatch = password === user.password_hash;

  if (!isMatch) {
    throw new Error('Invalid username or password');
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      whatsapp: user.whatsapp || '',
      email: user.email || '',
    },
  };
};