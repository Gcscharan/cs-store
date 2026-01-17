import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuthState, setUser, setTokens } from "../store/slices/authSlice";
import { toApiUrl } from "../config/runtime";
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
    const role = params.get("role");
    const isAdmin = params.get("isAdmin") === "true";
    const authState = params.get("authState");
    const email = params.get("email");
    const name = params.get("name");
    const error = params.get("error");

    if (error) {
      showError("Authentication Failed", `Error: ${error}`);
      navigate("/login"); // Redirect to login page on error
      return;
    }

    // GOOGLE_AUTH_ONLY: onboarding token only (no user record yet)
    if (token && authState === "GOOGLE_AUTH_ONLY") {
      console.log('🔥 OAUTH CALLBACK: GOOGLE_AUTH_ONLY session detected');
      cleanUserSwitch();

      setTimeout(() => {
        dispatch(setTokens({
          accessToken: token,
          refreshToken: null,
        }));
        dispatch(setAuthState("GOOGLE_AUTH_ONLY"));
        // Store minimal identity for prefill/display only (NOT a real user record)
        dispatch(setUser({
          authState: "GOOGLE_AUTH_ONLY",
          email: email ? decodeURIComponent(email) : undefined,
          name: name ? decodeURIComponent(name) : undefined,
          provider: "google",
        }));

        window.location.href = "/onboarding/complete-profile";
      }, 50);
      return;
    }

    if (token && refreshToken && userId) {
      // CRITICAL: Clean ALL previous user state BEFORE setting new auth
      console.log('🔥 OAUTH CALLBACK: Aggressive cleanup BEFORE new login...');
      cleanUserSwitch();
      
      // Small delay to ensure cleanup is complete, then set auth and redirect
      setTimeout(() => {
        console.log('🔥 OAUTH CALLBACK: Setting new user auth after cleanup...');
        dispatch(setTokens({
          accessToken: token,
          refreshToken: refreshToken,
        }));
        dispatch(setAuthState("ACTIVE"));
        
        success("Login Successful", "You have been logged in via Google.");
        
        // Use window.location for more reliable redirect after OAuth
        // This ensures the redirect happens even if React Router is in a transition state
        setTimeout(async () => {
          try {
            const meRes = await fetch(
              toApiUrl("/auth/me"),
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            const meData = await meRes.json();
            if (meRes.ok && meData?.user) {
              dispatch(setUser(meData.user));
            }

            // PRIORITY 1: Admins
            if (isAdmin || role === "admin") {
              window.location.href = "/admin";
              return;
            }

            const profileCompleted = !!meData?.user?.profileCompleted;
            if (!profileCompleted) {
              window.location.href = "/onboarding/complete-profile";
              return;
            }

            window.location.href = "/dashboard";
          } catch {
            // fallback: if we can't resolve, go to dashboard and let guards decide
            window.location.href = "/dashboard";
          }
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
