import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { AUTH_EXPIRED_EVENT } from '../lib/api';
import { authStorage } from '../lib/authStorage';
import { AuthContext } from './auth-context';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (authStorage.get() ? 'loading' : 'ready'));

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/api/users/me');
    setUser(data);
    return data;
  }, []);

  // Restore the session from a saved token on first load.
  useEffect(() => {
    if (!authStorage.get()) return;
    let cancelled = false;
    api
      .get('/api/users/me')
      .then(({ data }) => !cancelled && setUser(data))
      .catch(() => authStorage.clear())
      .finally(() => !cancelled && setStatus('ready'));
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client fires this when the server rejects the token.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const startSession = useCallback(({ accessToken, user: nextUser }) => {
    authStorage.set(accessToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/api/auth/login', { email, password });
      return startSession(data);
    },
    [startSession],
  );

  const register = useCallback(
    async ({ name, email, password }) => {
      const { data } = await api.post('/api/auth/register', { name, email, password });
      return startSession(data);
    },
    [startSession],
  );

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, status, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
