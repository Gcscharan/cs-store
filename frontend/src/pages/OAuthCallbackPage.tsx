import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setUser, setTokens } from "../store/slices/authSlice";
import { useToast } from "../components/AccessibleToast";
import { useCleanUserSwitch } from "../hooks/useLogout";
import { motion } from "framer-motion";

const OAuthCallbackPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { success, error: showError } = useToast();
  const cleanUserSwitch = useCleanUserSwitch();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const refreshToken = params.get("refreshToken");
    const userId = params.get("userId");
    const email = params.get("email");
    const role = params.get("role");
    const isAdmin = params.get("isAdmin") === "true";
    const isProfileComplete = params.get("isProfileComplete") === "true";
    const error = params.get("error");

    if (error) {
      showError("Authentication Failed", `Error: ${error}`);
      navigate("/login"); // Redirect to login page on error
      return;
    }

    if (token && refreshToken && userId) {
      // CRITICAL: Clean ALL previous user state BEFORE setting new auth
      console.log('🔥 OAUTH CALLBACK: Aggressive cleanup BEFORE new login...');
      cleanUserSwitch();
      
      // Small delay to ensure cleanup is complete, then set auth and redirect
      setTimeout(() => {
        console.log('🔥 OAUTH CALLBACK: Setting new user auth after cleanup...');
        dispatch(setUser({
          id: userId,
          email: email || "",
          role: role || "customer",
          isAdmin: isAdmin,
          isProfileComplete: isProfileComplete,
        } as any));
        dispatch(setTokens({
          accessToken: token,
          refreshToken: refreshToken,
        }));
        
        success("Login Successful", "You have been logged in via Google.");
        
        // Use window.location for more reliable redirect after OAuth
        // This ensures the redirect happens even if React Router is in a transition state
        setTimeout(() => {
          // PRIORITY 1: Check for Admin Role FIRST - bypass all onboarding checks
          if (isAdmin || role === "admin") {
            window.location.href = "/admin";
            return;
          }
          
          // PRIORITY 2: For non-admin users, check if profile is complete
          if (!isProfileComplete) {
            window.location.href = "/onboarding/complete-profile";
            return;
          }
          
          // Default redirect for regular users with complete profiles - go to dashboard
          window.location.href = "/dashboard";
        }, 150); // Small delay to ensure auth state is saved
      }, 100); // Increased delay slightly to ensure state is set
    } else {
      showError(
        "Authentication Failed",
        "Missing authentication tokens or user data."
      );
      navigate("/login"); // Redirect to login page if data is incomplete
    }
  }, [location.search, navigate, dispatch]); // Removed success and showError from dependencies

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center min-h-screen bg-gray-50"
    >
      <div className="text-center p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Processing Login...
        </h2>
        <p className="text-gray-600">Please wait while we log you in.</p>
      </div>
    </motion.div>
  );
};

export default OAuthCallbackPage;
