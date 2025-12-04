import React from "react";
import { useSelector } from "react-redux";
import { useLocation, Navigate } from "react-router-dom";
import { RootState } from "../store";

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
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  console.log("[ProtectedRoute] isAuthenticated:", isAuthenticated, "path:", location.pathname);

  // Minimal pattern: only redirect if auth required and not authenticated
  if (requireAuth && !isAuthenticated) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
