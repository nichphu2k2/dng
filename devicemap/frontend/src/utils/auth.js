const TOKEN_KEY = "devicemap.auth.token";
const USER_KEY = "devicemap.auth.user";
const REQUIRE_PASSWORD_CHANGE_KEY = "devicemap.auth.requirePasswordChange";
const REMEMBER_ME_KEY = "devicemap.auth.rememberMe";

const getStorage = (storage) => {
  try {
    return window[storage];
  } catch {
    return null;
  }
};

const getAuthStorage = () => {
  const sessionStorage = getStorage("sessionStorage");
  if (sessionStorage?.getItem(TOKEN_KEY)) return sessionStorage;
  const localStorage = getStorage("localStorage");
  return localStorage?.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
};

export const getToken = () => {
  try {
    return getAuthStorage()?.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const getAuthUser = () => {
  try {
    const raw = getAuthStorage()?.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setAuthSession = ({ token, user, requirePasswordChange = false, rememberMe = false }) => {
  if (!token || !user) return;

  const target = getStorage(rememberMe ? "localStorage" : "sessionStorage");
  const other = getStorage(rememberMe ? "sessionStorage" : "localStorage");
  other?.removeItem(TOKEN_KEY);
  other?.removeItem(USER_KEY);
  other?.removeItem(REQUIRE_PASSWORD_CHANGE_KEY);
  other?.removeItem(REMEMBER_ME_KEY);
  target?.setItem(TOKEN_KEY, token);
  target?.setItem(USER_KEY, JSON.stringify(user));
  target?.setItem(REQUIRE_PASSWORD_CHANGE_KEY, requirePasswordChange ? "1" : "0");
  target?.setItem(REMEMBER_ME_KEY, rememberMe ? "1" : "0");
};

export const requiresPasswordChange = () => {
  try {
    return getAuthStorage()?.getItem(REQUIRE_PASSWORD_CHANGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const setRequiresPasswordChange = (value) => {
  getAuthStorage()?.setItem(REQUIRE_PASSWORD_CHANGE_KEY, value ? "1" : "0");
};

export const clearAuthSession = () => {
  for (const storage of [getStorage("localStorage"), getStorage("sessionStorage")]) {
    storage?.removeItem(TOKEN_KEY);
    storage?.removeItem(USER_KEY);
    storage?.removeItem(REQUIRE_PASSWORD_CHANGE_KEY);
    storage?.removeItem(REMEMBER_ME_KEY);
  }
};

export const isAuthenticated = () => Boolean(getToken());
