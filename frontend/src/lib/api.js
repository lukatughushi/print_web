import axios from 'axios';
import { authStorage } from './authStorage';
import { API_URL } from './config';

// Single API client. Request paths include the /api prefix, e.g. api.get('/api/products').
const api = axios.create({ baseURL: API_URL });

export const AUTH_EXPIRED_EVENT = 'auth:expired';

api.interceptors.request.use((config) => {
  const token = authStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 on an authenticated request means the token is invalid or expired.
    // AuthProvider listens for this event and signs the user out.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      authStorage.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Extracts a readable message from a NestJS error response. */
export function getErrorMessage(error, fallback = 'Something went wrong') {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string') return message;
  if (!error?.response) return 'სერვერთან კავშირი ვერ მოხერხდა';
  return fallback;
}

export default api;
