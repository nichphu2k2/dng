const APP_ROUTES = [
  "login",
  "no-permission",
  "change-password",
  "monitor",
  "devices",
  "device-types",
  "planes",
  "settings",
  "reports"
];

/**
 * Returns the application subpath prefix (e.g. "/devicemap" or "")
 * dynamically determined from window.location.pathname.
 * Never ends with a trailing slash.
 */
export const getAppBasePath = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const pathname = window.location.pathname || "/";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return "";
  }

  const routeIndex = segments.findIndex((seg) => APP_ROUTES.includes(seg));

  if (routeIndex === -1) {
    // URL does not match any known route segment (e.g. accessed at "/devicemap" or "/custom-path")
    return "/" + segments.join("/");
  }

  if (routeIndex === 0) {
    // First segment is an app route (e.g. "/monitor"), so base path is root
    return "";
  }

  return "/" + segments.slice(0, routeIndex).join("/");
};

export default getAppBasePath;

