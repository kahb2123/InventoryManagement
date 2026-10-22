import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  try {
    const token = window.localStorage.getItem('buildstock.token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      try {
        window.localStorage.removeItem('buildstock.token');
        window.localStorage.removeItem('buildstock.user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      } catch {
        /* ignore */
      }
    }
    const message =
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED' ? 'The request took too long. Please try again.' : null) ||
      (error.request ? 'Cannot reach the server. Check that the API is running.' : error.message);
    const enriched = error;
    enriched.userMessage = message;
    enriched.details = error.response?.data?.details;
    enriched.code = error.response?.data?.code;
    return Promise.reject(enriched);
  }
);

export const get = (url, config) => api.get(url, config);
export const post = (url, data, config) => api.post(url, data, config);
export const patch = (url, data, config) => api.patch(url, data, config);
export const put = (url, data, config) => api.put(url, data, config);
export const del = (url, config) => api.delete(url, config);

export default api;
