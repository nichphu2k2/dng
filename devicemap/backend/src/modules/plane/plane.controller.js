const service = require("./plane.service");

const getAll = async (req, res) => {
  try {
    const data = await service.getAll();
    res.json(data);
  } catch (err) {
    console.error("GET /api/planes - Error:", err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
};

const getNextId = async (req, res) => {
  try {
    const id = await service.getNextId();
    res.json({ id });
  } catch (err) {
    console.error("GET /api/planes/next-id - Error:", err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create({
      data: req.body,
      file: req.file
    });

    res.status(201).json(data);
  } catch (err) {
    console.error("POST /api/planes - Error:", err.message);
    res.status(err.status || 400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, {
      data: req.body,
      file: req.file
    });

    res.json(data);
  } catch (err) {
    console.error("PUT /api/planes/:id - Error:", err.message);
    res.status(err.status || 400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const data = await service.remove(req.params.id);
    res.json(data);
  } catch (err) {
    console.error("DELETE /api/planes/:id - Error:", err.message);
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
