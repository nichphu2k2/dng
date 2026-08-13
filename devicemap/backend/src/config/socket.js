let io;

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    io.on("connection", (socket) => {
      console.log("Socket Connected:", socket.id);

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
  }
};