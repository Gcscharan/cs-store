import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setUser, setTokens, setAuthState } from "../store/slices/authSlice";
import { RootState } from "../store";
import { toApiUrl } from "../config/runtime";
import { useLogout } from "../hooks/useLogout";
import { motion } from "framer-motion";
import { User, Phone, Mail, ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { useToast } from "./AccessibleToast";

const OnboardingForm: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, tokens, profileCompleted, authState } = useSelector((state: RootState) => state.auth);
  const { success, error: showError } = useToast();
  const performLogout = useLogout();

  // SAFETY: If profile is already completed, redirect away immediately
  useEffect(() => {
    if (profileCompleted) {
      navigate("/", { replace: true });
    }
  }, [profileCompleted, navigate]);

  // Terminal rule: only GOOGLE_AUTH_ONLY can use onboarding
  useEffect(() => {
    if (authState && authState !== "GOOGLE_AUTH_ONLY") {
      navigate("/dashboard", { replace: true });
    }
  }, [authState, navigate]);

  // Prefill name from Google (if available)
  useEffect(() => {
    const nextName = String((user as any)?.name || "").trim();
    if (nextName) {
      setFormData((prev) => ({ ...prev, name: nextName }));
    }
  }, [user]);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = "Full name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters long";
    }

    // Validate phone
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[6-9]\d{9}$/.test(formData.phone.trim())) {
      newErrors.phone = "Please enter a valid 10-digit mobile number starting with 6-9";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
    
    // Reset OTP verification state if phone changes
    if (name === "phone") {
      // Clear OTP-related errors and state when phone changes
      setOtpError("");
      if (otpSent) {
        setOtpSent(false);
        setOtpVerified(false);
        setOtp("");
      }
    }
  };

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleSendOtp = async () => {
    // Validate phone first
    if (!formData.phone.trim()) {
      setErrors(prev => ({ ...prev, phone: "Phone number is required" }));
      return;
    }
    
    if (!/^[6-9]\d{9}$/.test(formData.phone.trim())) {
      setErrors(prev => ({ ...prev, phone: "Please enter a valid 10-digit mobile number starting with 6-9" }));
      return;
    }

    setIsSendingOtp(true);
    setOtpError("");
    
    try {
      console.log("🔍 Checking if phone exists:", formData.phone.trim());
      // First, check if phone number already exists in database
      const checkResponse = await fetch(toApiUrl("/auth/check-phone"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formData.phone.trim(),
        }),
      });

      const checkData = await checkResponse.json();
      console.log("📱 Phone check result:", checkData);

      if (checkResponse.ok && checkData.exists) {
        const errorMsg = "This phone number is already registered with another account. Please use a different number or sign in.";
        setOtpError(errorMsg);
        setErrors(prev => ({ ...prev, phone: errorMsg }));
        showError("Phone Number Exists", errorMsg);
        setIsSendingOtp(false);
        return;
      }

      console.log("📤 Sending OTP for phone:", formData.phone.trim());
      // Create OTP in "signup" type for onboarding finalization
      const response = await fetch(
        toApiUrl("/auth/send-otp?mode=signup"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: formData.phone.trim(),
          }),
        }
      );

      const data = await response.json();
      console.log("📨 OTP response:", { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.message || data.error || "Failed to send OTP. Please try again.";
        console.error("❌ OTP send failed:", errorMsg);
        setOtpError(errorMsg);
        return;
      }

      // OTP sent successfully
      console.log("✅ OTP sent successfully");
      setOtpSent(true);
      setOtpCooldown(60);
      success("OTP Sent", "A 6-digit OTP has been sent to your mobile number.");
    } catch (error) {
      console.error("❌ OTP send error:", error);
      setOtpError(error instanceof Error ? error.message : "Failed to send OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError("Please enter the 6-digit OTP");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError("");

    try {
      const response = await fetch(toApiUrl("/auth/verify-onboarding-otp"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokens?.accessToken || ""}`,
        },
        body: JSON.stringify({
          otp: otp.trim(),
          phone: formData.phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.message || "Invalid OTP. Please try again.";
        
        // Show specific error messages
        if (errorMessage.includes("not found") || errorMessage.includes("expired")) {
          setOtpError("OTP not found or expired. Please request a new OTP.");
        } else if (errorMessage.includes("Invalid OTP")) {
          setOtpError(`Invalid OTP. ${data.attemptsRemaining ? `${data.attemptsRemaining} attempts remaining.` : 'Please try again.'}`);
        } else if (errorMessage.includes("Maximum OTP attempts exceeded")) {
          setOtpError("Maximum OTP attempts exceeded. Please request a new OTP.");
        } else {
          setOtpError(errorMessage);
        }
        return;
      }

      setOtpVerified(true);
      setOtpError("");
      
      success("Mobile Verified", "Your mobile number has been verified successfully!");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Failed to verify OTP. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Check if OTP is verified
    if (!otpVerified) {
      setErrors(prev => ({ ...prev, phone: "Please verify your mobile number with OTP first" }));
      if (!otpSent) {
        showError("OTP Required", "Please send and verify OTP for your mobile number.");
      } else {
        showError("OTP Not Verified", "Please verify the OTP sent to your mobile number.");
      }
      return;
    }

    // Check onboarding session before proceeding
    if (!tokens?.accessToken || authState !== "GOOGLE_AUTH_ONLY") {
      console.error("No access token available");
      showError(
        "Authentication Error", 
        "You are not logged in. Please log in again to continue."
      );
      navigate("/login");
      return;
    }

    console.log("Access token exists:", !!tokens.accessToken);
    console.log("Token preview:", tokens.accessToken?.substring(0, 20) + "...");

    setIsSubmitting(true);

    try {
      const response = await fetch(toApiUrl("/auth/complete-onboarding"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          fullName: formData.name.trim(),
          phone: formData.phone.trim(),
          otp: otp.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          console.error("401 Unauthorized - Token may be expired or invalid");
          showError(
            "Session Expired", 
            "Your session has expired. Please log in again."
          );
          // Clear the auth state and redirect to login
          performLogout();
          return;
        }
        
        // Handle phone number already registered error specifically
        if (response.status === 400 && data.error?.includes("phone number is already registered")) {
          console.error("Phone number already registered:", formData.phone);
          setErrors(prev => ({
            ...prev,
            phone: "This phone number is already associated with another account."
          }));
          return;
        }
        
        // Handle other 400 errors that might indicate phone number conflicts
        if (response.status === 400 && data.error?.toLowerCase().includes("phone")) {
          console.error("Phone number error:", data.error);
          setErrors(prev => ({
            ...prev,
            phone: "This phone number is already associated with another account."
          }));
          return;
        }
        
        // Handle 409 conflict status (common for duplicate resources)
        if (response.status === 409) {
          console.error("Conflict error - likely duplicate phone number:", data.error);
          setErrors(prev => ({
            ...prev,
            phone: "This phone number is already associated with another account."
          }));
          return;
        }
        
        throw new Error(data.message || data.error || "Failed to complete onboarding");
      }

      if (data?.accessToken && data?.refreshToken && data?.user) {
        dispatch(setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }));
        dispatch(setUser({ ...data.user, authState: data.authState || "ACTIVE" }));
        dispatch(setAuthState("ACTIVE"));
      }

      success("Profile Completed", "Welcome to CS Store! Your account is ready.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Profile completion error:", error);
      showError(
        "Profile Completion Failed", 
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no user is authenticated, the ProtectedRoute wrapper will handle the redirect
  // We don't need to navigate here as it causes conflicts
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <User className="h-8 w-8 text-blue-600" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Complete Your Profile
            </h1>
            <p className="text-gray-600 text-sm">
              We need a few more details to get you started
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">This cannot be changed</p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.name ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter 10-digit mobile number"
                  disabled={otpVerified}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.phone ? "border-red-300 bg-red-50" : otpVerified ? "border-green-300 bg-green-50" : "border-gray-300"
                  } ${otpVerified ? "cursor-not-allowed" : ""}`}
                />
                {otpVerified && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  </div>
                )}
              </div>
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.phone}</p>
              )}
              {otpError && !otpSent && (
                <p className="text-red-500 text-xs mt-1 font-medium bg-red-50 p-2 rounded">{otpError}</p>
              )}
              {!otpSent && !otpVerified && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || !formData.phone.trim() || !/^[6-9]\d{9}$/.test(formData.phone.trim())}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed px-3 py-1.5 rounded hover:bg-blue-50 transition-colors"
                  >
                    {isSendingOtp ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                        Sending OTP...
                      </span>
                    ) : (
                      "Send OTP"
                    )}
                  </button>
                </div>
              )}
              {otpSent && !otpVerified && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center tracking-widest text-lg"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isVerifyingOtp || otp.length !== 6}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {isVerifyingOtp ? "Verifying..." : "Verify"}
                    </button>
                  </div>
                  {otpError && (
                    <p className="text-red-500 text-xs">{otpError}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpCooldown > 0 || isSendingOtp}
                      className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : "Resend OTP"}
                    </button>
                  </div>
                </div>
              )}
              {otpVerified && (
                <p className="text-green-600 text-xs mt-1 flex items-center">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Mobile number verified successfully
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                We'll use this to send order updates and OTP verification. Each phone number can only be used once.
              </p>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all ${
                isSubmitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200"
              } text-white`}
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Completing Profile...
                </div>
              ) : (
                <div className="flex items-center">
                  Complete Profile and Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              )}
            </motion.button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Sign In button clicked, navigating to /login");
                  navigate("/login", { replace: true });
                }}
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center cursor-pointer"
              >
                <LogIn className="h-4 w-4 mr-1" />
                Sign In
              </button>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              By completing your profile, you agree to our{" "}
              <a href="/terms" className="text-blue-600 hover:text-blue-700 underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingForm;
