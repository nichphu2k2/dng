let io;
const jwt = require("jsonwebtoken");
const { getActiveSessionByToken } = require("../modules/auth/auth-session-log.service");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    io.use(async (socket, next) => {
      try {
        const token = String(socket.handshake.auth?.token || "");
        if (!token) {
          const error = new Error("Socket authentication required");
          error.data = { code: "authentication_required" };
          return next(error);
        }

        const payload = jwt.verify(token, JWT_SECRET);
        const session = await getActiveSessionByToken(token);
        if (!session || Number(session.user_id) !== Number(payload.id)) {
          const error = new Error("Socket session revoked");
          error.data = { code: "session_revoked" };
          return next(error);
        }

        socket.data.sessionId = String(session.id);
        socket.data.userId = Number(session.user_id);
        return next();
      } catch {
        const error = new Error("Socket session invalid");
        error.data = { code: "session_invalid" };
        return next(error);
      }
    });

    io.on("connection", (socket) => {
      socket.join(`session:${socket.data.sessionId}`);

      socket.on("device:moved", (data) => {
        socket.broadcast.emit("device:moved", data);
      });
    });

    return io;
  },

  getIO: () => io,

  emitSensorMove: (sensor) => {
    if (!io) return;
    io.emit("sensor:moved", sensor);
  },

  emitDeviceMove: (device) => {
    if (!io) return;
    io.emit("device:moved", device);
  },

  emitSessionRevoked: (sessions, reason) => {
    if (!io) return;
    for (const session of sessions || []) {
      io.to(`session:${session.id}`).emit("session:revoked", { reason });
    }
  }
};