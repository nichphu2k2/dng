const service = require("./devicemap.service");

const getDeviceMap = async (req, res) => {
  try {
    const bodyPayload = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    const source = bodyPayload || req.query || {};
    const data = await service.getInfo(source);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const postDeviceMap = async (req, res) => {
  try {
    const data = await service.postAlarm(req.body || {});
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

module.exports = {
  getDeviceMap,
  postDeviceMap
};
