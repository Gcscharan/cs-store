import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { setAuth, logout } from "../store/slices/authSlice";
import { useRefreshTokenMutation } from "../store/api";

export const useTokenRefresh = () => {
  const dispatch = useDispatch();
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const [refreshTokenMutation] = useRefreshTokenMutation();

  const refreshToken = async (): Promise<boolean> => {
    try {
      if (!tokens?.refreshToken) {
        console.log("🔑 No refresh token available");
        return false;
      }

      console.log("🔑 Attempting to refresh token...");
      const result = await refreshTokenMutation(tokens.refreshToken).unwrap();

      if (result.accessToken) {
        console.log("🔑 Token refreshed successfully");
        dispatch(
          setAuth({
            user: user!,
            tokens: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken || tokens.refreshToken, // Keep existing refresh token if new one not provided
            },
          })
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error("🔑 Token refresh failed:", error);
      // If refresh fails, logout the user
      dispatch(logout());
      return false;
    }
  };

  return { refreshToken };
};
