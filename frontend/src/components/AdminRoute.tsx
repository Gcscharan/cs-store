import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, tokens } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    // Check if user is authenticated and is admin
    if (!isAuthenticated || !user?.isAdmin || !tokens?.accessToken) {
      // Clear any invalid auth data
      localStorage.removeItem("auth");
      navigate("/login");
      return;
    }
  }, [isAuthenticated, user, navigate, tokens]);

  // Show loading or redirect if not authenticated
  if (!isAuthenticated || !user?.isAdmin || !tokens?.accessToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
