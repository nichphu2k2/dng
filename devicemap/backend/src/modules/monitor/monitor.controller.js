const service = require("./monitor.service");

const getByPlane = async (req, res) => {
  try {
    const data = await service.getByPlane(req.params.planeId);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const saveByPlane = async (req, res) => {
  try {
    const placements = Array.isArray(req.body?.placements) ? req.body.placements : [];
    const data = await service.saveByPlane(req.params.planeId, placements);
    res.json(data);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

module.exports = {
  getByPlane,
  saveByPlane
};
