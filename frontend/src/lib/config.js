// Backend origin (no trailing slash, no /api). Set VITE_API_URL per environment.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn('VITE_API_URL is not set; API requests will go to http://localhost:3000');
}
