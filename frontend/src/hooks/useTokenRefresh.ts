import api from "../config/api";

export function useTokenRefresh() {
  async function refreshToken() {
    try {
      const res = await api.post("/api/auth/refresh");
      if (res.data?.accessToken) {
        localStorage.setItem("accessToken", res.data.accessToken);
        return true;
      }
      return false;
    } catch (err) {
      return false;   // IMPORTANT: do not throw 401
    }
  }
  return { refreshToken };
}
