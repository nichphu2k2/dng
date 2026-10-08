const service = require("./auth.service");

const getRequestMeta = (req) => {
  return {
    ipAddress: req.headers["x-forwarded-for"] || req.ip,
    userAgent: req.headers["user-agent"] || ""
  };
};

const login = async (req, res) => {
  try {
    const data = await service.login({
      ...(req.body || {}),
      ...getRequestMeta(req)
    });
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

    const data = await service.changePassword({
      userId: req.auth?.id,
      oldPassword: req.body?.oldPassword,
      newPassword: req.body?.newPassword,
      sessionId: req.auth?.sessionId,
      sessionToken: token,
      ...getRequestMeta(req)
    });

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const logout = async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

    const data = await service.logout({
      token,
      userId: req.auth?.id,
      ...getRequestMeta(req)
    });

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const session = async (req, res) => {
  const user = await service.getSessionUser(req.auth?.id);
  if (!user) {
    return res.status(401).json({ success: false, message: "Session is invalid or expired" });
  }

  return res.json({ success: true, user, session_id: req.auth.sessionId });
};

module.exports = {
  login,
  changePassword,
  logout,
  session
};
