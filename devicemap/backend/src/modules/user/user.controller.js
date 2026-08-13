const service = require("./user.service");

const getRequestMeta = (req) => {
  return {
    actionBy: req.auth?.id || null,
    sessionId: req.auth?.sessionId || null,
    sessionToken: req.auth?.sessionToken || null,
    ipAddress: req.headers["x-forwarded-for"] || req.ip,
    userAgent: req.headers["user-agent"] || ""
  };
};

const getAll = async (req, res) => {
  try {
    const data = await service.listUsers(req.query || {});
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getUserById(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  }
};

const create = async (req, res) => {
  try {
    const avatarUrl = req.file ? `/image/user/${req.file.filename}` : null;
    const data = await service.createUser({
      data: req.body || {},
      avatarUrl,
      context: getRequestMeta(req)
    });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  }
};

const update = async (req, res) => {
  try {
    const avatarUrl = req.file ? `/image/user/${req.file.filename}` : null;
    const data = await service.updateUser(req.params.id, {
      data: req.body || {},
      avatarUrl,
      context: getRequestMeta(req)
    });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  }
};

const remove = async (req, res) => {
  try {
    await service.removeUser(req.params.id, getRequestMeta(req));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};
