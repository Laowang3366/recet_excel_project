export const TOKEN_STORAGE_KEY = "excel_forum_token";
export const USER_STORAGE_KEY = "excel_forum_user";
export const SESSION_EVENT = "excel-forum-session-changed";
export const AUTH_REMEMBER_KEY = "excel_forum_auth_remember";

export type SessionUser = {
  id: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role?: string | null;
  sourceChannel?: string | null;
  level?: number | null;
  points?: number | null;
  exp?: number | null;
  forceChangePassword?: boolean | null;
  bio?: string | null;
  expertise?: string | null;
  gender?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  website?: string | null;
  coverImage?: string | null;
  notificationEmailEnabled?: boolean;
  notificationPushEnabled?: boolean;
  themePreference?: string | null;
  lastLoginTime?: string | null;
};

function readStorage(key: string) {
  const sessionValue = window.sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;
  return window.localStorage.getItem(key);
}

export function getStoredToken(): string | null {
  return readStorage(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): SessionUser | null {
  const raw = readStorage(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: SessionUser, remember = false) {
  const primaryStorage = remember ? window.localStorage : window.sessionStorage;
  const secondaryStorage = remember ? window.sessionStorage : window.localStorage;
  primaryStorage.setItem(TOKEN_STORAGE_KEY, token);
  primaryStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  secondaryStorage.removeItem(TOKEN_STORAGE_KEY);
  secondaryStorage.removeItem(USER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

export function updateStoredUser(user: SessionUser | null) {
  if (!user) {
    window.sessionStorage.removeItem(USER_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } else {
    const useLocalStorage = window.localStorage.getItem(TOKEN_STORAGE_KEY) !== null
      || window.localStorage.getItem(USER_STORAGE_KEY) !== null;
    const primaryStorage = useLocalStorage ? window.localStorage : window.sessionStorage;
    const secondaryStorage = useLocalStorage ? window.sessionStorage : window.localStorage;
    primaryStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    secondaryStorage.removeItem(USER_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

export function clearStoredSession() {
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

export type RememberedAuth = {
  username: string;
};

export function getRememberedAuth(): RememberedAuth | null {
  const raw = window.localStorage.getItem(AUTH_REMEMBER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RememberedAuth> & { password?: unknown };
    if (typeof parsed.username === "string" && parsed.username.trim()) {
      const remembered = { username: parsed.username };
      if ("password" in parsed) {
        window.localStorage.setItem(AUTH_REMEMBER_KEY, JSON.stringify(remembered));
      }
      return remembered;
    }
  } catch {
    return null;
  }
  return null;
}

export function storeRememberedAuth(value: RememberedAuth | null) {
  if (!value || !value.username.trim()) {
    window.localStorage.removeItem(AUTH_REMEMBER_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_REMEMBER_KEY, JSON.stringify({ username: value.username.trim() }));
}
