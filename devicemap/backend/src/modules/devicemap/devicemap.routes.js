const router = require("express").Router();
const controller = require("./devicemap.controller");
const settingsService = require("../settings/settings.service");

const unauthorized = (res, message) => {
  res.set("WWW-Authenticate", 'Basic realm="DeviceMap API"');
  return res.status(401).json({
    success: false,
    message
  });
};

const forbidden = (res, message) => {
  return res.status(403).json({
    success: false,
    message
  });
};

const verifyBasicAuth = async (req, res, next) => {
  try {
    const authorizationHeader = String(req.headers.authorization || "").trim();
    if (!authorizationHeader) {
      return unauthorized(res, "Missing Authorization header");
    }

    const [scheme, encoded] = authorizationHeader.split(" ");
    if (String(scheme || "").toLowerCase() !== "basic" || !encoded) {
      return unauthorized(res, "Invalid Authorization header format");
    }

    let decoded = "";
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      return unauthorized(res, "Invalid Authorization header encoding");
    }

    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return unauthorized(res, "Invalid Basic credentials");
    }

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    const alertSetup = await settingsService.getAlertSetup();
    const expectedUsername = String(alertSetup.username || "");
    const expectedPassword = String(alertSetup.password || "");

    if (!expectedUsername || !expectedPassword) {
      return forbidden(res, "Basic authentication is not configured");
    }

    if (username !== expectedUsername || password !== expectedPassword) {
      return forbidden(res, "Invalid username or password");
    }

    return next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

router.use(verifyBasicAuth);
router.get("/", controller.getDeviceMap);
router.post("/", controller.postDeviceMap);

module.exports = router;
