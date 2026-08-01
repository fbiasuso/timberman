import axios from 'axios';

// VITE_API_URL lets a hosted build point the client at the deployed API
// (e.g. https://api.example.com). Falls back to '/api', which the Vite dev
// server proxies to http://localhost:3001.
const apiBaseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

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
