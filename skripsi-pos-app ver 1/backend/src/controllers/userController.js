const db = require('../config/db');

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

exports.getUsers = async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, username, role, email, whatsapp, created_at
       FROM users
       ORDER BY FIELD(role, 'owner', 'manager', 'cashier'), name ASC, username ASC`
    );

    return res.status(200).json({
      success: true,
      message: 'Users loaded successfully',
      data: rows,
    });
  } catch (error) {
    console.error('GET USERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load users',
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, username, password, role, email, whatsapp } = req.body;
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

    const [[existingUser]] = await db.execute(
      `SELECT id FROM users WHERE username = ? LIMIT 1`,
      [username]
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists',
      });
    }

    const [result] = await db.execute(
      `INSERT INTO users (name, username, password_hash, role, email, whatsapp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, username, password, nextRole, email || null, whatsapp || null]
    );

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('CREATE USER ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { name, email, whatsapp, password, role } = req.body;

    const [[existingUser]] = await db.execute(
      `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (isManager(req.user) && normalizeRole(existingUser.role) === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot edit owner accounts',
      });
    }

    const nextRole = role ? normalizeRole(role) : normalizeRole(existingUser.role);

    if (!VALID_ROLES.includes(nextRole)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be owner, manager, or cashier',
      });
    }

    if (!canActorUseRole(req.user, nextRole)) {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot set a user role to owner',
      });
    }

    if (password && password.trim()) {
      await db.execute(
        `UPDATE users
         SET name = ?, email = ?, whatsapp = ?, role = ?, password_hash = ?
         WHERE id = ?`,
        [name || '', email || null, whatsapp || null, nextRole, password, userId]
      );
    } else {
      await db.execute(
        `UPDATE users
         SET name = ?, email = ?, whatsapp = ?, role = ?
         WHERE id = ?`,
        [name || '', email || null, whatsapp || null, nextRole, userId]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('UPDATE USER ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user',
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (req.user?.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    const [[existingUser]] = await db.execute(
      `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (isManager(req.user) && normalizeRole(existingUser.role) === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot delete owner accounts',
      });
    }

    await db.execute(`DELETE FROM users WHERE id = ?`, [userId]);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('DELETE USER ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
    });
  }
};
