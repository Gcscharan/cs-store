/**
 * Axios instance export for direct API usage
 * 
 * This re-exports the production-grade axios instance with:
 * - Automatic token refresh on 401 TOKEN_EXPIRED
 * - Request queue during refresh
 * - Concurrent request retry
 * 
 * For RTK Query, use the api slice from store/api.ts which has its own refresh logic.
 */

export { 
  default as api,
  registerTokenGetter,
  registerTokenSetter,
  registerLogoutAction,
} from "../api/axiosInstance";

// Legacy exports for backward compatibility
import api from "../api/axiosInstance";
export default api;
