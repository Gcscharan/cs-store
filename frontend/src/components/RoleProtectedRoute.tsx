import React from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { RootState } from "../store";
import { authRedirect } from "../utils/authRedirect";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ("customer" | "admin" | "delivery")[];
  redirectTo?: string;
  unauthenticatedRedirectTo?: string;
}

/**
 * Role-based route protection component.
 * Blocks access based on user role and redirects to appropriate dashboard.
 */
const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  allowedRoles,
  redirectTo: _redirectTo,
  unauthenticatedRedirectTo,
}) => {
  const { isAuthenticated, user, authState, loading } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const role = user?.isAdmin || user?.role === "admin" ? "admin" : (user?.role || "customer");
  const redirect = authRedirect({
    authState: (authState ?? null) as any,
    pathname: location.pathname,
    role: role as any,
    isProtected: true,
    allowedRoles,
  });

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  // Backward compatible override for unauthenticated redirects (runs only if canonical didn't redirect)
  if (!isAuthenticated) {
    return <Navigate to={unauthenticatedRedirectTo || "/login"} replace />;
  }

  // Role is allowed - render children
  return <>{children}</>;
};

export default RoleProtectedRoute;
