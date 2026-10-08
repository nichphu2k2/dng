import { getAuthUser } from "../utils/auth";
import { hasRole } from "../utils/permissions";

export default function Permission({ roles = [], fallback = null, children }) {
  const user = getAuthUser();

  if (!hasRole(user, roles)) {
    return fallback;
  }

  return children;
}
