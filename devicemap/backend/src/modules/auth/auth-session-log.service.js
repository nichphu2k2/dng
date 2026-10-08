const UserSession = require("../user/user-session.model");
const UserLog = require("../user/user-log.model");

const normalizeIp = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  return text.startsWith("::ffff:") ? text.slice(7) : text;
};

const normalizeUserAgent = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const createUserLog = async ({
  targetUser,
  action,
  actionBy = null,
  sessionId = null,
  sessionToken = null,
  ipAddress = null,
  userAgent = null,
  description = null
}) => {
  await UserLog.create({
    user_id: targetUser?.id || null,
    username: targetUser?.username || null,
    email: targetUser?.email || null,
    full_name: targetUser?.full_name || null,
    role: targetUser?.role || null,
    user_status: targetUser?.status || null,
    session_id: sessionId,
    session_token: sessionToken || null,
    ip_address: normalizeIp(ipAddress),
    user_agent: normalizeUserAgent(userAgent),
    action,
    action_by: actionBy,
    description: description || null,
    created_at: new Date()
  });
};

const createUserSession = async ({ userId, sessionToken, ipAddress = null, userAgent = null }) => {
  const now = new Date();
  return UserSession.create({
    user_id: userId,
    session_token: sessionToken,
    ip_address: normalizeIp(ipAddress),
    user_agent: normalizeUserAgent(userAgent),
    status: "ACTIVE",
    login_at: now,
    last_activity_at: now
  });
};

const invalidateActiveSessionsByUserId = async ({
  userId,
  nextStatus = "EXPIRED",
  targetUser = null,
  actionBy = null,
  ipAddress = null,
  userAgent = null,
  description = null,
  writeLogs = false
}) => {
  const activeSessions = await UserSession.findAll({
    where: {
      user_id: userId,
      status: "ACTIVE"
    },
    order: [["id", "ASC"]]
  });

  if (activeSessions.length === 0) {
    return [];
  }

  const now = new Date();
  for (const session of activeSessions) {
    const updates = {
      status: nextStatus,
      last_activity_at: now
    };

    if (nextStatus === "LOGOUT") {
      updates.logout_at = now;
    }

    if (nextStatus === "EXPIRED") {
      updates.expired_at = now;
    }

    await session.update(updates);

    if (writeLogs && targetUser) {
      await createUserLog({
        targetUser,
        action: "LOGOUT",
        actionBy,
        sessionId: session.id,
        sessionToken: session.session_token,
        ipAddress,
        userAgent,
        description: description || (nextStatus === "EXPIRED"
          ? "Session invalidated by new login"
          : "Session logged out")
      });
    }
  }

  return activeSessions;
};

const getActiveSessionByToken = async (sessionToken) => {
  return UserSession.findOne({
    where: {
      session_token: sessionToken,
      status: "ACTIVE"
    }
  });
};

const touchSessionActivity = async (sessionId) => {
  await UserSession.update(
    { last_activity_at: new Date() },
    { where: { id: sessionId } }
  );
};

const logoutSessionByToken = async ({
  sessionToken,
  targetUser,
  actionBy = null,
  ipAddress = null,
  userAgent = null,
  description = "User logout"
}) => {
  const session = await UserSession.findOne({
    where: {
      session_token: sessionToken,
      status: "ACTIVE"
    }
  });

  if (!session) {
    return null;
  }

  const now = new Date();
  await session.update({
    status: "LOGOUT",
    logout_at: now,
    last_activity_at: now
  });

  if (targetUser) {
    await createUserLog({
      targetUser,
      action: "LOGOUT",
      actionBy,
      sessionId: session.id,
      sessionToken: session.session_token,
      ipAddress,
      userAgent,
      description
    });
  }

  return session;
};

module.exports = {
  createUserLog,
  createUserSession,
  invalidateActiveSessionsByUserId,
  getActiveSessionByToken,
  touchSessionActivity,
  logoutSessionByToken,
  normalizeIp,
  normalizeUserAgent
};
