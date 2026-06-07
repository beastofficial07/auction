import axios from 'axios';

const TOKEN_KEY = 'bca_token';

export const saveToken = (t: string) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch {}
};

export const getToken = (): string => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};

export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
};

// ✅ FIXED: Use environment variable directly, not Next.js rewrite
// baseURL includes /api so all route paths are relative (e.g. '/auctions/my')
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

/**
 * Resolve a player/team image URL.
 * - Cloudinary / external URLs (start with http) → returned as-is
 * - Local /uploads/ paths → prepend the backend base URL
 * - null / undefined → return empty string (caller shows fallback)
 */
export const imgUrl = (src?: string | null): string => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  // Local path like /uploads/filename.jpg — prepend backend origin
  return `${BASE}${src.startsWith('/') ? '' : '/'}${src}`;
};

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,  // ✅ Changed to true for cookies
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  // Debug: log every outgoing request URL
  console.log(`🌐 API ${config.method?.toUpperCase()} → ${config.baseURL}${config.url}`, token ? '🔑 token present' : '🔓 no token');
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const p = window.location.pathname;
      const pub = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
      if (!pub.some(pp => p.startsWith(pp)) && p !== '/') {
        clearToken();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
