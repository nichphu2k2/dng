import { io } from "socket.io-client";
import { getToken } from "../utils/auth";
import { getAppBasePath } from "../utils/basePath";

// Empty/undefined VITE_SOCKET_URL means "same origin as the page" so the
// request goes through Nginx (which proxies /socket.io/ to the backend).
const socketUrl = String(import.meta.env.VITE_SOCKET_URL || "").trim() || window.location.origin;
const basePath = getAppBasePath();
const socketPath = basePath ? `${basePath}/socket.io` : "/socket.io";
const socket = io(socketUrl, {
  path: socketPath,
  transports: ["websocket", "polling"],
  autoConnect: false
});

export const connectSocket = () => {
  const token = getToken();
  if (!token) return;
  socket.auth = { token };
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = () => {
  socket.disconnect();
};

export default socket;