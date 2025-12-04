import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { logout } from "../store/slices/authSlice";
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
  const { isAuthenticated, tokens } = useSelector((state: RootState) => state.auth);
  const hasValidated = useRef(false);

  // Only attempt profile fetch if authenticated and token exists
  const shouldFetch = isAuthenticated && tokens.accessToken && !hasValidated.current;

  const {
    error,
    isError,
    isFetching,
  } = useGetProfileQuery(undefined, {
    skip: !shouldFetch,
  });

  useEffect(() => {
    // Only logout on specific authentication errors, not all errors
    if (shouldFetch && isError && !isFetching) {
      const status = (error as any)?.status;
      const originalStatus = (error as any)?.originalStatus;
      
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
      }
    }

    // If fetch succeeded, mark as validated
    if (shouldFetch && !isError && !isFetching) {
      console.log('✅ AUTH INITIALIZER: Token validated successfully');
      hasValidated.current = true;
    }
  }, [shouldFetch, isError, isFetching, error, dispatch]);

  // This component doesn't render anything - it's just for side effects
  return null;
}
