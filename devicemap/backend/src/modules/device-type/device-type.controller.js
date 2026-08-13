const service = require("./device-type.service");

const getAll = async (req, res) => {
  try {
    const data = await service.getAll(req.query);
    res.json(data);
  } catch (err) {
    console.error("GET /device-types - Error:", err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
};

const getNextId = async (req, res) => {
  try {
    const id = await service.getNextId();
    res.json({ id });
  } catch (err) {
    console.error("GET /device-types/next-id - Error:", err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body);
    res.status(201).json(data);
  } catch (err) {
    console.error("POST /device-types - Error:", err.message);
    res.status(err.status || 400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    console.error("PUT /device-types/:id - Error:", err.message);
    res.status(err.status || 400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const data = await service.remove(req.params.id);
    res.json(data);
  } catch (err) {
    console.error("DELETE /device-types/:id - Error:", err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = {
  getAll,
  getNextId,
  create,
  update,
  remove
};
