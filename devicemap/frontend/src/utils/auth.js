const TOKEN_KEY = "devicemap.auth.token";
const USER_KEY = "devicemap.auth.user";
const REQUIRE_PASSWORD_CHANGE_KEY = "devicemap.auth.requirePasswordChange";

export const getToken = () => {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const getAuthUser = () => {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setAuthSession = ({ token, user, requirePasswordChange = false }) => {
  if (!token || !user) return;

  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(REQUIRE_PASSWORD_CHANGE_KEY, requirePasswordChange ? "1" : "0");
};

export const requiresPasswordChange = () => {
  try {
    return window.localStorage.getItem(REQUIRE_PASSWORD_CHANGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const setRequiresPasswordChange = (value) => {
  window.localStorage.setItem(REQUIRE_PASSWORD_CHANGE_KEY, value ? "1" : "0");
};

export const clearAuthSession = () => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(REQUIRE_PASSWORD_CHANGE_KEY);
};

export const isAuthenticated = () => Boolean(getToken());
