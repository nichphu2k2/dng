const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../user/user.model");
const {
  createUserLog,
  createUserSession,
  invalidateActiveSessionsByUserId,
  logoutSessionByToken
} = require("./auth-session-log.service");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_REMEMBER_ME_EXPIRES_IN = process.env.JWT_REMEMBER_ME_EXPIRES_IN || JWT_EXPIRES_IN;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

const toPublicUser = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    full_name: row.full_name || "",
    role: row.role,
    status: row.status,
    avatar_url: row.avatar_url || "",
    last_login: row.last_login,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

const createToken = (user, rememberMe = false) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: rememberMe ? JWT_REMEMBER_ME_EXPIRES_IN : JWT_EXPIRES_IN }
  );
};

const ensureDefaultAdmin = async () => {
  const existing = await User.findOne({ where: { username: "admin" } });

  const defaultPasswordHash = await bcrypt.hash("admin", 10);

  if (!existing) {
    await User.create({
      username: "admin",
      email: "duythang.nguyen@dngcorp.vn",
      password_hash: defaultPasswordHash,
      full_name: "Administrator",
      role: "ADMIN",
      status: "ACTIVE",
      password_changed_at: null
    });
    return;
  }

  const currentPasswordHash = String(existing.password_hash || "").trim();
  const isFirstLoginState = !existing.password_changed_at;
  const updates = {};
  if (existing.email !== "duythang.nguyen@dngcorp.vn") updates.email = "duythang.nguyen@dngcorp.vn";
  if (existing.full_name !== "Administrator") updates.full_name = "Administrator";
  if (existing.role !== "ADMIN") updates.role = "ADMIN";
  if (existing.status !== "ACTIVE") updates.status = "ACTIVE";

  if (!currentPasswordHash) {
    updates.password_hash = defaultPasswordHash;
    updates.password_changed_at = null;
  } else if (!BCRYPT_HASH_PATTERN.test(currentPasswordHash)) {
    // Migrate legacy plain password values to bcrypt while keeping the same credential.
    if (isFirstLoginState) {
      updates.password_hash = defaultPasswordHash;
      updates.password_changed_at = null;
    } else {
      updates.password_hash = await bcrypt.hash(currentPasswordHash, 10);
      updates.password_changed_at = existing.password_changed_at || new Date();
    }
  } else if (isFirstLoginState) {
    const isDefaultPassword = await bcrypt.compare("admin", currentPasswordHash);
    if (!isDefaultPassword) {
      updates.password_hash = defaultPasswordHash;
      updates.password_changed_at = null;
    }
  }

  if (Object.keys(updates).length > 0) {
    await existing.update(updates);
  }
};

const login = async ({ username, password, rememberMe = false, ipAddress = null, userAgent = null }) => {
  const normalizedUsername = String(username || "").trim();
  const rawPassword = String(password || "");

  if (!normalizedUsername || !rawPassword) {
    const error = new Error("Username and password are required");
    error.status = 400;
    throw error;
  }

  const user = await User.findOne({ where: { username: normalizedUsername } });

  if (!user) {
    const error = new Error("Invalid username or password");
    error.status = 401;
    throw error;
  }

  if (user.status !== "ACTIVE") {
    const error = new Error("Account is inactive");
    error.status = 403;
    throw error;
  }

  const matched = await bcrypt.compare(rawPassword, user.password_hash);
  if (!matched) {
    const error = new Error("Invalid username or password");
    error.status = 401;
    throw error;
  }

  const invalidatedSessions = await invalidateActiveSessionsByUserId({
    userId: user.id,
    nextStatus: "EXPIRED",
    targetUser: user,
    actionBy: user.id,
    ipAddress,
    userAgent,
    description: "Previous active session expired on new login",
    writeLogs: true
  });

  const token = createToken(user, Boolean(rememberMe));
  const session = await createUserSession({
    userId: user.id,
    sessionToken: token,
    ipAddress,
    userAgent
  });

  await user.update({ last_login: new Date() });

  await createUserLog({
    targetUser: user,
    action: "LOGIN",
    actionBy: user.id,
    sessionId: session.id,
    sessionToken: token,
    ipAddress,
    userAgent,
    description: "Login successful"
  });

  const socket = require("../../config/socket");
  socket.emitSessionRevoked(invalidatedSessions, "logged_in_elsewhere");

  return {
    token,
    user: toPublicUser(user),
    require_password_change: !user.password_changed_at,
    session_id: session.id
  };
};

const changePassword = async ({
  userId,
  oldPassword,
  newPassword,
  sessionId = null,
  sessionToken = null,
  ipAddress = null,
  userAgent = null
}) => {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid user id");
    error.status = 400;
    throw error;
  }

  const currentPassword = String(oldPassword || "");
  const nextPassword = String(newPassword || "").trim();
  if (!currentPassword || !nextPassword) {
    const error = new Error("oldPassword and newPassword are required");
    error.status = 400;
    throw error;
  }

  const user = await User.findByPk(id);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  const matched = await bcrypt.compare(currentPassword, String(user.password_hash || ""));
  if (!matched) {
    const error = new Error("Old password is incorrect");
    error.status = 401;
    throw error;
  }

  const newPasswordHash = await bcrypt.hash(nextPassword, 10);
  await user.update({
    password_hash: newPasswordHash,
    password_changed_at: new Date()
  });

  await createUserLog({
    targetUser: user,
    action: "CHANGE_PASSWORD",
    actionBy: user.id,
    sessionId,
    sessionToken,
    ipAddress,
    userAgent,
    description: "Password changed"
  });

  return {
    success: true
  };
};

const logout = async ({ token, userId, ipAddress = null, userAgent = null }) => {
  if (!token) {
    const error = new Error("Missing token");
    error.status = 400;
    throw error;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  await logoutSessionByToken({
    sessionToken: token,
    targetUser: user,
    actionBy: user.id,
    ipAddress,
    userAgent,
    description: "Manual logout"
  });

  return { success: true };
};

module.exports = {
  login,
  ensureDefaultAdmin,
  toPublicUser,
  changePassword,
  logout,
  getSessionUser: async (userId) => toPublicUser(await User.findByPk(userId))
};
