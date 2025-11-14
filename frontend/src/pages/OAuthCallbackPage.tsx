import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuth } from "../store/slices/authSlice";
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
      
      // Small delay to ensure cleanup is complete
      setTimeout(() => {
        console.log('🔥 OAUTH CALLBACK: Setting new user auth after cleanup...');
        dispatch(
          setAuth({
            user: {
              id: userId,
              email: email || "",
              role: role || "customer",
              isAdmin: isAdmin,
              isProfileComplete: isProfileComplete,
            } as any,
            tokens: {
              accessToken: token,
              refreshToken: refreshToken,
            },
          })
        );
      }, 50);
      success("Login Successful", "You have been logged in via Google.");
      
      // Check if profile is complete - if not, redirect to onboarding
      if (!isProfileComplete) {
        navigate("/onboarding/complete-profile");
        return;
      }
      
      // Redirect to admin routes if admin, otherwise home
      if (isAdmin) {
        navigate("/admin");
      } else {
        navigate("/");
      }
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
