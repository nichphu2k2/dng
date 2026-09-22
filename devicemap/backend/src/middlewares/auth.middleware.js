const jwt = require("jsonwebtoken");
const { getActiveSessionByToken, touchSessionActivity } = require("../modules/auth/auth-session-log.service");

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  const header = String(req.headers.authorization || "").trim();
  if (!header) {
    return res.status(401).json({
      success: false,
      message: "Missing Authorization header"
    });
  }

  const [scheme, token] = header.split(" ");
  if (String(scheme || "").toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Invalid Authorization header"
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const session = await getActiveSessionByToken(token);

    if (!session || Number(session.user_id) !== Number(payload.id)) {
      return res.status(401).json({
        success: false,
        message: "Session is invalid or expired"
      });
    }

    await touchSessionActivity(session.id);

    req.auth = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      sessionId: session.id,
      sessionToken: token
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

module.exports = authMiddleware;
