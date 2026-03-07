import { ReactNode, Suspense } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { RootState } from "../store";

/**
 * AuthGate - Central Route Decision Engine
 * 
 * ARCHITECTURE: This is the ONLY component that makes auth-based routing decisions.
 * All route protection logic is centralized here.
 * 
 * State Machine:
 * - LOADNG: Wait (return null)
 * - UNAUTHENTICATED: Redirect to /login if requireAuth
 * - GOOGLE_AUTH_ONLY: Allow only onboarding routes, redirect others to /onboarding/complete-profile
 * - ACTIVE: Check role restrictions, allow access
 * 
 * Props:
 * - requireAuth: If true, unauthenticated users redirect to /login
 * - allowOnboarding: If true, GOOGLE_AUTH_ONLY users can access this route
 * - requiredRole: If set, only users with matching role can access
 */

export type UserRole = "admin" | "customer" | "delivery";

interface AuthGateProps {
  children: ReactNode;
  /** If true, unauthenticated users are redirected to /login */
  requireAuth?: boolean;
  /** If true, GOOGLE_AUTH_ONLY users can access this route (for onboarding pages) */
  allowOnboarding?: boolean;
  /** If set, only users with this role can access */
  requiredRole?: UserRole;
  /** Fallback redirect path for unauthorized users (default: /unauthorized) */
  unauthorizedRedirect?: string;
}

export default function AuthGate({
  children,
  requireAuth = false,
  allowOnboarding = false,
  requiredRole,
  unauthorizedRedirect = "/unauthorized",
}: AuthGateProps) {
  const { status, user } = useSelector((state: RootState) => state.auth);

  // 1️⃣ LOADING: Wait for auth to stabilize
  // This prevents race conditions where guards run before auth is verified
  if (status === "LOADING") {
    return null; // Or a loading spinner component
  }

  // 2️⃣ UNAUTHENTICATED: Redirect to login if auth required
  if (status === "UNAUTHENTICATED") {
    if (requireAuth) {
      return <Navigate to="/login" replace />;
    }
    return <Suspense fallback={null}>{children}</Suspense>;
  }

  // 3️⃣ GOOGLE_AUTH_ONLY: Onboarding-only state
  // These users have a valid Google OAuth token but no full user record yet
  if (status === "GOOGLE_AUTH_ONLY") {
    if (allowOnboarding) {
      return <Suspense fallback={null}>{children}</Suspense>;
    }
    // Redirect all non-onboarding routes to complete profile
    return <Navigate to="/onboarding/complete-profile" replace />;
  }

  // 4️⃣ ACTIVE: Fully authenticated user
  if (status === "ACTIVE") {
    // Check role restriction
    if (requiredRole) {
      const userRole = (user?.role as UserRole) || "customer";
      const isAdmin = user?.isAdmin === true || user?.role === "admin";
      
      // Admin can access admin routes
      if (requiredRole === "admin" && isAdmin) {
        return <Suspense fallback={null}>{children}</Suspense>;
      }
      
      // Exact role match required for other roles
      if (userRole !== requiredRole && !(requiredRole === "admin" && isAdmin)) {
        // Redirect to appropriate dashboard based on role
        if (isAdmin) {
          return <Navigate to="/admin" replace />;
        }
        if (userRole === "delivery") {
          return <Navigate to="/delivery/dashboard" replace />;
        }
        return <Navigate to={unauthorizedRedirect} replace />;
      }
    }
    
    return <Suspense fallback={null}>{children}</Suspense>;
  }

  // Fallback: Should never reach here with valid status
  return <Navigate to="/login" replace />;
}
