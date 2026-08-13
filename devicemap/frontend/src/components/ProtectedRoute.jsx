import { Navigate, useLocation } from "react-router-dom";

import NoPermission from "../pages/NoPermission";
import { getAuthUser, isAuthenticated, requiresPasswordChange } from "../utils/auth";
import { canAccessRoute, hasRole } from "../utils/permissions";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();
  const user = getAuthUser();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const needChangePassword = requiresPasswordChange();
  if (needChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (!needChangePassword && location.pathname === "/change-password") {
    return <Navigate to="/" replace />;
  }

  if (!hasRole(user, allowedRoles)) {
    return <NoPermission />;
  }

  if (!canAccessRoute(user, location.pathname)) {
    return <NoPermission />;
  }

  return children;
}
