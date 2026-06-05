module.exports = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles.map((role) =>
    String(role || '').toLowerCase().trim()
  );

  return (req, res, next) => {
    const userRole = String(req.user?.role || '').toLowerCase().trim();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    next();
  };
};
