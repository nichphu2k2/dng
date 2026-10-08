const service = require("./device.service");

const getAll = async (req, res) => {
  try {
    console.log("GET /devices - Query:", req.query);
    const data = await service.getAll(req.query);
    console.log("GET /devices - Response:", data?.length || 0, "devices");
    res.json(data);
  } catch (err) {
    console.error("GET /devices - Error:", err.message, err);
    res.status(500).json({ message: err.message, stack: process.env.NODE_ENV === "development" ? err.stack : undefined });
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    if (!data) return res.status(404).json({ message: "Device not found" });
    res.json(data);
  } catch (err) {
    console.error("GET /devices/:id - Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create({ data: req.body, files: req.files || [] });
    res.json(data);
  } catch (err) {
    console.error("POST /devices - Error:", err.message);
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, { data: req.body, files: req.files || [] });
    res.json(data);
  } catch (err) {
    console.error("PUT /devices/:id - Error:", err.message);
    res.status(400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await service.remove(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /devices/:id - Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

const getNextId = async (req, res) => {
  try {
    const id = await service.getNextId();
    res.json({ id });
  } catch (err) {
    console.error("GET /devices/next-id - Error:", err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
};

const getByCode = async (req, res) => {
  try {
    const result = await service.getByCodeAndTriggerAlert(req.params.deviceCode);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const turnOff = async (req, res) => {
  try {
    const data = await service.turnOff(req.params.id);
    res.json({
      success: true,
      output: data.output || ""
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal Server Error"
    });
  }
};

module.exports = {
  getAll,
  getNextId,
  getById,
  getByCode,
  turnOff,
  create,
  update,
  remove
};