import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useLocation, Navigate } from "react-router-dom";
import { useOtpModal } from "../contexts/OtpModalContext";
import { RootState } from "../store";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  redirectTo,
}) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { showOtpModal } = useOtpModal();
  const location = useLocation();

  // Add a ref to prevent multiple modal triggers
  const hasTriggeredModal = useRef(false);

  useEffect(() => {
    console.log(
      "ProtectedRoute: isAuthenticated =",
      isAuthenticated,
      "requireAuth =",
      requireAuth,
      "hasTriggeredModal =",
      hasTriggeredModal.current
    );
    console.log("ProtectedRoute: Current path =", location.pathname);

    if (requireAuth && !isAuthenticated && !hasTriggeredModal.current) {
      console.log("ProtectedRoute: Triggering OTP modal for first time");
      hasTriggeredModal.current = true;
      // Show OTP modal when user tries to access protected route
      showOtpModal(location.pathname);
    } else if (isAuthenticated) {
      // Reset the flag when user becomes authenticated
      hasTriggeredModal.current = false;
    } else {
      console.log(
        "ProtectedRoute: Not showing modal - isAuthenticated:",
        isAuthenticated,
        "requireAuth:",
        requireAuth,
        "hasTriggeredModal:",
        hasTriggeredModal.current
      );
    }
  }, [isAuthenticated, requireAuth, showOtpModal, location.pathname]);

  // If authentication is required and user is not authenticated
  if (requireAuth && !isAuthenticated) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
    }
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
