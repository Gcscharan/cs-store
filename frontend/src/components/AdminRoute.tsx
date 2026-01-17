import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { authRedirect } from "../utils/authRedirect";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const location = useLocation();
  const { user, isAuthenticated, tokens, authState, loading } = useSelector(
    (state: RootState) => state.auth
  );

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
    allowedRoles: ["admin"],
  });

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  // Defensive: if tokens/user are missing for ACTIVE-admin sessions, fall back to login.
  if (!isAuthenticated || !tokens?.accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
