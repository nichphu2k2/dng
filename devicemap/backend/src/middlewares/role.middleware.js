const roleMiddleware = (allowedRoles = []) => {
  const normalizedRoles = Array.isArray(allowedRoles)
    ? allowedRoles.map((item) => String(item || "").toUpperCase())
    : [];

  return (req, res, next) => {
    const userRole = String(req.auth?.role || "").toUpperCase();
    if (!userRole || !normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden"
      });
    }

    return next();
  };
};

module.exports = roleMiddleware;
