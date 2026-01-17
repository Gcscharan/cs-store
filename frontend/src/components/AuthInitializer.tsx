import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { logout, setUser, setLoading, setAuthState } from "../store/slices/authSlice";
import { useGetProfileQuery } from "../store/api";

/**
 * AuthInitializer - Validates stored authentication tokens on app startup
 * 
 * Problem: The app was auto-logging in users from localStorage without verifying
 * that their tokens were still valid on the backend.
 * 
 * Solution: On initial mount, if a token exists in Redux state, immediately
 * call /api/user/profile to validate it. Only logout on specific auth errors.
 * 
 * This ensures users are never "logged in" with invalid/expired tokens.
 */
export default function AuthInitializer() {
  const dispatch = useDispatch();
  const { isAuthenticated, tokens, authState } = useSelector((state: RootState) => state.auth);
  const hasValidated = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !tokens.accessToken) {
      dispatch(setLoading(false));
      hasValidated.current = true;
    }
  }, [isAuthenticated, tokens.accessToken, dispatch]);

  // Only attempt profile fetch if authenticated and token exists
  const shouldFetch = isAuthenticated && tokens.accessToken && !hasValidated.current;

  const {
    error,
    isError,
    isFetching,
    data,
  } = useGetProfileQuery(undefined, {
    skip: !shouldFetch,
  });

  useEffect(() => {
    // Only logout on specific authentication errors, not all errors
    if (shouldFetch && isError && !isFetching) {
      const status = (error as any)?.status;
      const originalStatus = (error as any)?.originalStatus;

      // GOOGLE_AUTH_ONLY sessions do not have a user record yet and use an onboarding-only token.
      // /api/auth/me may return 401/403/404; do NOT force logout. Route guards will redirect to onboarding.
      if (authState === "GOOGLE_AUTH_ONLY") {
        hasValidated.current = true;
        dispatch(setLoading(false));
        return;
      }
      
      // Only logout on actual authentication failures
      const isAuthError = status === 401 || status === 403 || status === 404 ||
                         originalStatus === 401 || originalStatus === 403 || originalStatus === 404;
      
      if (isAuthError) {
        console.warn('🔐 AUTH INITIALIZER: Authentication error detected, logging out', {
          error,
          status,
          originalStatus,
        });

        // Mark as validated to prevent infinite loops
        hasValidated.current = true;

        // Token is invalid - logout and clear everything
        dispatch(logout());

        // Force reload to ensure clean state
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      } else {
        // For other errors (network, server errors), don't logout
        console.warn('🔐 AUTH INITIALIZER: Non-auth error, not logging out', {
          error,
          status,
          originalStatus,
        });
        hasValidated.current = true; // Still mark as validated to prevent retries
        dispatch(setLoading(false));
      }
    }

    // If fetch succeeded, store authoritative user data and mark as validated
    if (shouldFetch && !isError && !isFetching && data) {
      console.log('✅ AUTH INITIALIZER: Token validated successfully');
      hasValidated.current = true;
      // Store authoritative user object including profileCompleted
      dispatch(setUser(data));
      dispatch(setAuthState("ACTIVE"));
      dispatch(setLoading(false));
    }
  }, [shouldFetch, isError, isFetching, error, data, dispatch, authState]);

  // This component doesn't render anything - it's just for side effects
  return null;
}
