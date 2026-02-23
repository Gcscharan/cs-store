import axios from "axios";
import { store } from "../store";

import { getApiOrigin } from "./runtime";
import { refreshAccessToken } from "../utils/authClient";

const API_URL = getApiOrigin();

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
    const status = Number(error?.response?.status || 0);
    const code = String(error?.response?.data?.code || "").trim();
    const msg = String(error?.response?.data?.message || "").trim().toLowerCase();

    const isExpired = status === 401 && (code === "TOKEN_EXPIRED" || msg === "token expired");
    const cfg = error?.config as any;
    if (isExpired && cfg && !cfg.__retryOnce) {
      cfg.__retryOnce = true;
      const next = await refreshAccessToken();
      if (next) {
        cfg.headers = cfg.headers || {};
        cfg.headers.Authorization = `Bearer ${next}`;
        return api.request(cfg);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
