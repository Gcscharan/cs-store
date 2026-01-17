import React from "react";
import { useSelector } from "react-redux";
import { useLocation, Navigate } from "react-router-dom";
import { RootState } from "../store";
import { authRedirect } from "../utils/authRedirect";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true, 
  redirectTo 
}) => {
  const { user, isAuthenticated, authState } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  console.log("[ProtectedRoute] isAuthenticated:", isAuthenticated, "path:", location.pathname);

  const role = user?.isAdmin || user?.role === "admin" ? "admin" : (user?.role || "customer");

  const canonical = authRedirect({
    authState: (authState ?? null) as any,
    pathname: location.pathname,
    role: role as any,
    isProtected: !!requireAuth,
  });

  if (canonical) {
    return <Navigate to={canonical} replace />;
  }

  // Backward compatible explicit redirect override (only used when auth requires it)
  if (requireAuth && !isAuthenticated && redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
