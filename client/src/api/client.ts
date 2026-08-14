import axios from 'axios';

// VITE_API_URL is the API origin (e.g. https://timberman-api.onrender.com).
// Every server route lives under /api/*, so the client appends the prefix
// unless the value already includes it. Without VITE_API_URL it falls back to
// a relative '/api', which the Vite dev server proxies to the local API.
export function resolveApiBaseURL(raw: string | undefined): string {
  if (!raw) return '/api';
  const origin = raw.replace(/\/+$/, '');
  return origin.endsWith('/api') ? origin : `${origin}/api`;
}

const apiBaseURL = resolveApiBaseURL(import.meta.env.VITE_API_URL as string | undefined);

const client = axios.create({
  baseURL: apiBaseURL,
});

// Attach JWT from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — clear expired session
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-token');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default client;
