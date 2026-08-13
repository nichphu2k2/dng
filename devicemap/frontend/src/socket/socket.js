import { io } from "socket.io-client";

// Empty/undefined VITE_SOCKET_URL means "same origin as the page" so the
// request goes through Nginx (which proxies /socket.io/ to the backend).
const socketUrl = String(import.meta.env.VITE_SOCKET_URL || "").trim() || window.location.origin;
const socket = io(socketUrl, {
  path: "/socket.io",
  transports: ["websocket", "polling"]
});

export default socket;