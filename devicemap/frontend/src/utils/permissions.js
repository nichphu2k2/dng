const VIEWER_ROUTES = new Set([
  "/",
  "/maps",
  "/monitor",
  "/reports"
]);

const OPERATOR_ROUTES = new Set([
  ...VIEWER_ROUTES,
  "/device-types",
  "/devices",
  "/planes"
]);

const ADMIN_ONLY_ROUTES = new Set([
  "/settings/alert-setup",
  "/settings/line-parameters",
  "/settings/users"
]);

export const hasRole = (user, allowedRoles = []) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  const role = String(user?.role || "").toUpperCase();
  return allowedRoles.includes(role);
};

export const canAccessRoute = (user, pathname) => {
  const role = String(user?.role || "").toUpperCase();
  const path = String(pathname || "").replace(/\/+$/, "") || "/";

  if (!role) return false;
  if (role === "ADMIN") return true;

  if (path.startsWith("/monitor/")) {
    return role === "OPERATOR" || role === "VIEWER";
  }

  if (ADMIN_ONLY_ROUTES.has(path)) {
    return false;
  }

  if (role === "OPERATOR") {
    return OPERATOR_ROUTES.has(path);
  }

  if (role === "VIEWER") {
    return VIEWER_ROUTES.has(path);
  }

  return false;
};
