import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import {
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  SESSION_EVENT,
  SessionUser,
  storeSession,
  updateStoredUser,
} from "./session-store";

type SessionContextValue = {
  user: SessionUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<SessionUser>;
  register: (payload: { username: string; email: string; password: string }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<SessionUser | null>;
  setUser: (user: SessionUser | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  const setUser = (nextUser: SessionUser | null) => {
    setUserState(nextUser);
    updateStoredUser(nextUser);
  };

  const refreshUser = async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setToken(null);
      setUserState(null);
      setLoading(false);
      return null;
    }

    try {
      const currentUser = await api.get<SessionUser>("/api/auth/current", { silent: true });
      setToken(currentToken);
      setUserState(currentUser);
      updateStoredUser(currentUser);
      return currentUser;
    } catch {
      clearStoredSession();
      setToken(null);
      setUserState(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    const handleSessionChange = () => {
      setToken(getStoredToken());
      setUserState(getStoredUser());
    };
    window.addEventListener(SESSION_EVENT, handleSessionChange);
    return () => window.removeEventListener(SESSION_EVENT, handleSessionChange);
  }, []);

  const login = async (username: string, password: string, remember = false) => {
    const response = await api.post<{ token: string; user: SessionUser }>(
      "/api/auth/login",
      { username, password },
      { auth: false }
    );
    storeSession(response.token, response.user, remember);
    setToken(response.token);
    setUserState(response.user);
    const refreshedUser = await refreshUser();
    return refreshedUser || response.user;
  };

  const register = async (payload: { username: string; email: string; password: string }) => {
    await api.post("/api/auth/register", payload, { auth: false });
    return login(payload.username, payload.password);
  };

  const logout = async () => {
    try {
      if (getStoredToken()) {
        await api.post("/api/auth/logout", undefined, { silent: true });
      }
    } finally {
      clearStoredSession();
      setToken(null);
      setUserState(null);
    }
  };

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [user, token, loading]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
