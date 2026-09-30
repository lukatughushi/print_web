const TOKEN_KEY = 'token';

// localStorage can throw (private mode, blocked storage), so every access is guarded.
export const authStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* session will just not persist */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('adminToken'); // token from the legacy Express API
    } catch {
      /* ignore */
    }
  },
};
