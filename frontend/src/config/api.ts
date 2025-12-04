import axios from "axios";
import { store } from "../store";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Get token from Redux store for consistency with RTK Query
  const state = store.getState();
  const token = (state as any).auth?.tokens?.accessToken;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      // Try to refresh token
      try {
        const refreshResponse = await axios.post(`${API_URL}/api/auth/refresh`);
        if (refreshResponse.data?.accessToken) {
          // Update Redux store with new token
          store.dispatch({
            type: 'auth/setTokens',
            payload: {
              accessToken: refreshResponse.data.accessToken,
              refreshToken: refreshResponse.data.refreshToken || null
            }
          });
          
          // Retry the original request
          error.config.headers.Authorization = `Bearer ${refreshResponse.data.accessToken}`;
          return api.request(error.config);
        }
      } catch (refreshError) {
        // Refresh failed, clear auth state and redirect to login
        console.log("Auto-logout: refresh token failed");
        store.dispatch({ type: 'auth/logout' });
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
