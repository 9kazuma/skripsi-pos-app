const pool = require('../config/db');

exports.logActivity = async ({ user_id, action_type, description, related_id = null }) => {
  await pool.execute(
    `INSERT INTO activity_logs (user_id, action_type, description, related_id)
     VALUES (?, ?, ?, ?)`,
    [user_id, action_type, description, related_id]
  );
};