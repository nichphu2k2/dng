const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const User = require("./user.model");
const { toPublicUser } = require("../auth/auth.service");
const {
  createUserLog,
  invalidateActiveSessionsByUserId
} = require("../auth/auth-session-log.service");

const ROLES = ["ADMIN", "OPERATOR", "VIEWER"];
const STATUSES = ["ACTIVE", "INACTIVE"];

const normalizeRole = (value) => String(value || "VIEWER").trim().toUpperCase();
const normalizeStatus = (value) => String(value || "ACTIVE").trim().toUpperCase();

const validateRole = (role) => {
  if (!ROLES.includes(role)) {
    const error = new Error("Invalid role");
    error.status = 400;
    throw error;
  }
};

const validateStatus = (status) => {
  if (!STATUSES.includes(status)) {
    const error = new Error("Invalid status");
    error.status = 400;
    throw error;
  }
};

const ensureUnique = async ({ username, email, excludeId = null }) => {
  const where = {
    [Op.or]: [
      { username },
      { email }
    ],
    ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
  };

  const existing = await User.findOne({ where });
  if (!existing) return;

  if (existing.username === username) {
    const error = new Error("Username already exists");
    error.status = 409;
    throw error;
  }

  const error = new Error("Email already exists");
  error.status = 409;
  throw error;
};

const sanitizeAvatarUrl = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const listUsers = async (query = {}) => {
  const keyword = String(query.keyword || "").trim();

  const where = {};
  if (keyword) {
    where[Op.or] = [
      { username: { [Op.like]: `%${keyword}%` } },
      { email: { [Op.like]: `%${keyword}%` } },
      { full_name: { [Op.like]: `%${keyword}%` } }
    ];
  }

  const rows = await User.findAll({
    where,
    order: [["id", "ASC"]]
  });

  return rows.map((item) => toPublicUser(item));
};

const getUserById = async (id) => {
  const row = await User.findByPk(id);
  if (!row) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  return toPublicUser(row);
};

const createUser = async ({ data = {}, avatarUrl = null, context = {} }) => {
  const username = String(data.username || "").trim();
  const email = String(data.email || "").trim();
  const password = String(data.password || "");
  const fullName = String(data.full_name || "").trim();
  const role = normalizeRole(data.role);
  const status = normalizeStatus(data.status);

  if (!username || !email || !password) {
    const error = new Error("username, email and password are required");
    error.status = 400;
    throw error;
  }

  validateRole(role);
  validateStatus(status);
  await ensureUnique({ username, email });

  const passwordHash = await bcrypt.hash(password, 10);
  const row = await User.create({
    username,
    email,
    password_hash: passwordHash,
    full_name: fullName || null,
    role,
    status,
    avatar_url: sanitizeAvatarUrl(avatarUrl),
    password_changed_at: new Date()
  });

  await createUserLog({
    targetUser: row,
    action: "CREATE_USER",
    actionBy: context.actionBy || null,
    sessionId: context.sessionId || null,
    sessionToken: context.sessionToken || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    description: "Create user"
  });

  return toPublicUser(row);
};

const updateUser = async (id, { data = {}, avatarUrl = null, context = {} }) => {
  const row = await User.findByPk(id);
  if (!row) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  const username = data.username !== undefined ? String(data.username || "").trim() : row.username;
  const email = data.email !== undefined ? String(data.email || "").trim() : row.email;
  const fullName = data.full_name !== undefined ? String(data.full_name || "").trim() : row.full_name;
  const role = data.role !== undefined ? normalizeRole(data.role) : row.role;
  const status = data.status !== undefined ? normalizeStatus(data.status) : row.status;

  if (!username || !email) {
    const error = new Error("username and email are required");
    error.status = 400;
    throw error;
  }

  validateRole(role);
  validateStatus(status);
  await ensureUnique({ username, email, excludeId: row.id });

  const updates = {
    username,
    email,
    full_name: fullName || null,
    role,
    status
  };

  if (avatarUrl !== null) {
    updates.avatar_url = sanitizeAvatarUrl(avatarUrl);
  }

  if (data.password !== undefined && String(data.password).length > 0) {
    updates.password_hash = await bcrypt.hash(String(data.password), 10);
    updates.password_changed_at = new Date();
  }

  await row.update(updates);

  await createUserLog({
    targetUser: row,
    action: "UPDATE_USER",
    actionBy: context.actionBy || null,
    sessionId: context.sessionId || null,
    sessionToken: context.sessionToken || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    description: "Update user"
  });

  return toPublicUser(row);
};

const removeUser = async (id, context = {}) => {
  const row = await User.findByPk(id);
  if (!row) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (row.username === "admin") {
    const error = new Error("Default admin cannot be deleted");
    error.status = 400;
    throw error;
  }

  await createUserLog({
    targetUser: row,
    action: "DELETE_USER",
    actionBy: context.actionBy || null,
    sessionId: context.sessionId || null,
    sessionToken: context.sessionToken || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    description: "Delete user"
  });

  await invalidateActiveSessionsByUserId({
    userId: row.id,
    nextStatus: "LOGOUT",
    targetUser: row,
    actionBy: context.actionBy || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    description: "Sessions invalidated due to user deletion",
    writeLogs: true
  });

  await row.destroy();
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  removeUser
};
