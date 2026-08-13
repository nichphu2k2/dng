const service = require("./settings.service");

const getLineParameters = async (req, res) => {
  try {
    const data = await service.getLineParameters();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const updateLineParameters = async (req, res) => {
  try {
    const data = await service.updateLineParameters(req.body || {});
    res.json(data);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

const getAlertSetup = async (req, res) => {
  try {
    const data = await service.getAlertSetup();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const updateAlertSetup = async (req, res) => {
  try {
    const data = await service.updateAlertSetup(req.body || {});
    res.json(data);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

const refreshRtsp = async (req, res) => {
  try {
    const data = await service.refreshRtsp();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to refresh RTSP"
    });
  }
};

module.exports = {
  getLineParameters,
  updateLineParameters,
  getAlertSetup,
  updateAlertSetup,
  refreshRtsp
};
