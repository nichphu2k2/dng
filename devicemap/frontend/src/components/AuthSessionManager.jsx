import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { validateSession } from "../api/auth";
import { clearAuthSession, getToken, getAuthUser } from "../utils/auth";
import socket, { connectSocket, disconnectSocket } from "../socket/socket";

export default function AuthSessionManager({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(() => !getToken() || !getAuthUser());

  useEffect(() => {
    const forceLogout = (reason) => {
      clearAuthSession();
      disconnectSocket();
      if (location.pathname !== "/login") {
        navigate("/login", { replace: true, state: { sessionRevoked: reason === "logged_in_elsewhere" } });
      }
    };

    const onRevoked = (payload) => forceLogout(payload?.reason);
    const onInvalid = (event) => forceLogout(event.detail?.reason);
    const onConnectError = (error) => {
      const code = error?.data?.code;
      if (code === "session_revoked" || code === "session_invalid") {
        forceLogout("session_invalid");
      }
    };
    socket.on("session:revoked", onRevoked);
    socket.on("connect_error", onConnectError);
    window.addEventListener("devicemap:auth-invalid", onInvalid);

    if (getToken() && getAuthUser()) {
      setReady(false);
      validateSession()
        .then(() => {
          connectSocket();
          setReady(true);
        })
        .catch(() => forceLogout("session_invalid"));
    } else {
      setReady(true);
    }

    return () => {
      socket.off("session:revoked", onRevoked);
      socket.off("connect_error", onConnectError);
      window.removeEventListener("devicemap:auth-invalid", onInvalid);
    };
  }, [location.pathname, navigate]);

  return ready ? children : null;
}