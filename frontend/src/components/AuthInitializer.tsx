import { useEffect, useRef, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { logout, setUser, setStatus } from "../store/slices/authSlice";
import { useGetProfileQuery } from "../store/api";

interface AuthInitializerProps {
  children: ReactNode;
}

/**
 * AuthInitializer - Validates stored authentication tokens on app startup
 * 
 * ARCHITECTURE: This is the boot-time guard that stabilizes auth state.
 * 
 * Flow:
 * 1. On app start, status is either LOADING, UNAUTHENTICATED, or GOOGLE_AUTH_ONLY
 * 2. If LOADING (has token), verify with backend via /api/user/profile
 * 3. On success: status -> ACTIVE, store user
 * 4. On auth error: status -> UNAUTHENTICATED (logout)
 * 5. On GOOGLE_AUTH_ONLY: skip verification (no user record yet)
 * 
 * Guards (AuthGate) will NOT run until status is stable (not LOADING).
 */
export default function AuthInitializer({ children }: AuthInitializerProps) {
  const dispatch = useDispatch();
  const { status, tokens } = useSelector((state: RootState) => state.auth);
  const hasValidated = useRef(false);

  // Only attempt profile fetch if status is LOADING (have token, need to verify)
  const shouldFetch = status === "LOADING" && tokens.accessToken && !hasValidated.current;

  const {
    error,
    isError,
    isFetching,
    data,
  } = useGetProfileQuery(undefined, {
    skip: !shouldFetch,
  });

  useEffect(() => {
    // Handle GOOGLE_AUTH_ONLY - no user record exists yet
    if (status === "GOOGLE_AUTH_ONLY" && !hasValidated.current) {
      console.log('🔐 AUTH INITIALIZER: GOOGLE_AUTH_ONLY session - skipping profile fetch');
      hasValidated.current = true;
      return;
    }

    // Handle UNAUTHENTICATED - nothing to validate
    if (status === "UNAUTHENTICATED" && !hasValidated.current) {
      hasValidated.current = true;
      return;
    }

    // Handle profile fetch results
    if (shouldFetch && isError && !isFetching) {
      const httpStatus = (error as any)?.status;
      const originalStatus = (error as any)?.originalStatus;

      // Only logout on actual authentication failures
      const isAuthError = httpStatus === 401 || httpStatus === 403 || httpStatus === 404 ||
                         originalStatus === 401 || originalStatus === 403 || originalStatus === 404;
      
      if (isAuthError) {
        console.warn('🔐 AUTH INITIALIZER: Token invalid, logging out', {
          httpStatus,
          originalStatus,
        });
        hasValidated.current = true;
        setTimeout(() => dispatch(logout()), 0);
      } else {
        // Network/server error - keep status as LOADING for retry, but mark validated to prevent loop
        console.warn('🔐 AUTH INITIALIZER: Non-auth error, keeping state', {
          httpStatus,
          originalStatus,
        });
        hasValidated.current = true;
        // Set to UNAUTHENTICATED to unblock the app
        setTimeout(() => dispatch(setStatus("UNAUTHENTICATED")), 0);
      }
    }

    // On success: store user and set ACTIVE
    if (shouldFetch && !isError && !isFetching && data) {
      console.log('✅ AUTH INITIALIZER: Token validated successfully');
      hasValidated.current = true;
      setTimeout(() => {
        dispatch(setUser(data));
        dispatch(setStatus("ACTIVE"));
      }, 0);
    }
  }, [status, shouldFetch, isError, isFetching, error, data, dispatch]);

  // Wait until auth state is stable before rendering children
  if (status === "LOADING") {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
}
