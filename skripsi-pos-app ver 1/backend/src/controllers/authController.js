const pool = require('../config/db');
const { loginUser } = require('../services/authService');

const VALID_ROLES = ['owner', 'manager', 'cashier'];
const MANAGER_ALLOWED_ROLES = ['manager', 'cashier'];

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function isOwner(user) {
  return normalizeRole(user?.role) === 'owner';
}

function isManager(user) {
  return normalizeRole(user?.role) === 'manager';
}

function canActorUseRole(actor, role) {
  const normalizedRole = normalizeRole(role);

  if (!VALID_ROLES.includes(normalizedRole)) {
    return false;
  }

  if (isOwner(actor)) {
    return true;
  }

  if (isManager(actor)) {
    return MANAGER_ALLOWED_ROLES.includes(normalizedRole);
  }

  return false;
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const result = await loginUser(username, password);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, whatsapp, email, current_password, new_password } = req.body || {};

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = rows[0];

    if (new_password && current_password !== user.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const nextName = name?.trim() || user.name;
    const nextWhatsapp = whatsapp?.trim?.() ?? user.whatsapp ?? '';
    const nextEmail = email?.trim?.() ?? user.email ?? '';
    const nextPassword = new_password ? new_password : user.password_hash;

    await pool.execute(
      `UPDATE users
       SET name = ?, whatsapp = ?, email = ?, password_hash = ?
       WHERE id = ?`,
      [nextName, nextWhatsapp, nextEmail, nextPassword, user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        name: nextName,
        username: user.username,
        role: user.role,
        whatsapp: nextWhatsapp,
        email: nextEmail,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, username, password, role, whatsapp, email } = req.body || {};
    const nextRole = normalizeRole(role);

    if (!name || !username || !password || !nextRole) {
      return res.status(400).json({
        success: false,
        message: 'Name, username, password, and role are required',
      });
    }

    if (!VALID_ROLES.includes(nextRole)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be owner, manager, or cashier',
      });
    }

    if (!canActorUseRole(req.user, nextRole)) {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot create owner accounts',
      });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists',
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO users (name, username, password_hash, role, whatsapp, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, username, password, nextRole, whatsapp || null, email || null]
    );

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: result.insertId,
        name,
        username,
        role: nextRole,
        whatsapp: whatsapp || '',
        email: email || '',
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
    });
  }
};

exports.getUsers = async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, username, role, whatsapp, email, created_at
       FROM users
       ORDER BY name ASC`
    );

    return res.status(200).json({
      success: true,
      message: 'Users loaded successfully',
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load users',
    });
  }
};