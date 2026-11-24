import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); return null; }
    try { const me = await api('/me'); setUser(me); return me; }
    catch { setUser(null); return null; }
  }, []);

  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  const login = async (path, body) => {
    const { token, user } = await api(path, { method: 'POST', body });
    setToken(token);
    setUser(user);
    return user;
  };
  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, ready, setUser, refresh, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
