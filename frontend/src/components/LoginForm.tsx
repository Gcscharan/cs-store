import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { motion } from "framer-motion";
import { setAuth } from "../store/slices/authSlice";
import OAuthLogin from "./OAuthLogin";

interface LoginFormData {
  emailOrPhone: string;
  otp: string;
}

const LoginForm: React.FC = () => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState<LoginFormData>({
    emailOrPhone: "",
    otp: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Handle URL parameters to pre-fill email/phone
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailOrPhoneParam = urlParams.get("emailOrPhone");
    if (emailOrPhoneParam) {
      setFormData((prev) => ({
        ...prev,
        emailOrPhone: decodeURIComponent(emailOrPhoneParam),
      }));
    }
  }, []);

  // Function to detect if input is email or phone
  const detectInputType = (input: string): "email" | "phone" => {
    // Check if it contains @ symbol (email) or is all digits (phone)
    if (input.includes("@")) {
      return "email";
    } else if (/^[0-9]{10,15}$/.test(input.replace(/\D/g, ""))) {
      return "phone";
    } else {
      // Default to email if unclear
      return "email";
    }
  };

  const checkDeliverySelfie = async (accessToken: string) => {
    try {
      const response = await fetch("/api/delivery/selfie-url", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.selfieUrl) {
          // Selfie exists, go to dashboard
          window.location.href = "/delivery";
        } else {
          // No selfie, go to selfie verification
          window.location.href = "/delivery-selfie";
        }
      } else {
        // Error checking selfie, go to selfie verification
        window.location.href = "/delivery-selfie";
      }
    } catch (error) {
      console.error("Error checking selfie:", error);
      // Error checking selfie, go to selfie verification
      window.location.href = "/delivery-selfie";
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.emailOrPhone.trim()) {
      newErrors.emailOrPhone = "Email or phone number is required";
    } else {
      const inputType = detectInputType(formData.emailOrPhone);
      if (inputType === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailOrPhone)) {
          newErrors.emailOrPhone = "Please enter a valid email address";
        }
      } else {
        const phoneDigits = formData.emailOrPhone.replace(/\D/g, "");
        if (!/^[0-9]{10,15}$/.test(phoneDigits)) {
          newErrors.emailOrPhone =
            "Please enter a valid phone number (10-15 digits)";
        }
      }
    }

    if (otpSent && !formData.otp.trim()) {
      newErrors.otp = "OTP is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const inputType = detectInputType(formData.emailOrPhone);
      console.log("🔍 Sending OTP request:", {
        inputType,
        emailOrPhone: formData.emailOrPhone,
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [inputType]: formData.emailOrPhone,
        }),
      });

      const data = await response.json();
      console.log("🔍 OTP send response:", { status: response.status, data });

      if (response.ok) {
        setOtpSent(true);
        setErrors({});
      } else {
        // Handle account not found case
        if (response.status === 404 && data.action === "signup_required") {
          console.log("❌ User not found - redirecting to signup");
          setErrors({
            general: `Account not found for ${formData.emailOrPhone}. Please sign up first.`,
          });
          
          // Auto-redirect to signup page after 2 seconds
          setTimeout(() => {
            window.location.href = `/signup?emailOrPhone=${encodeURIComponent(formData.emailOrPhone)}`;
          }, 2000);
        } else {
          setErrors({ general: data.error || data.details || "Failed to send OTP" });
        }
      }
    } catch (error) {
      console.error("🔍 OTP send error:", error);
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const inputType = detectInputType(formData.emailOrPhone);
      console.log("🔍 Verifying OTP request:", {
        inputType,
        emailOrPhone: formData.emailOrPhone,
        otp: formData.otp,
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [inputType]: formData.emailOrPhone,
          otp: formData.otp,
        }),
      });

      const data = await response.json();
      console.log("🔍 OTP verify response:", { status: response.status, data });

      if (response.ok) {
        console.log("🔍 Login successful, user data:", data.user);
        console.log("🔍 Auth tokens:", {
          accessToken: data.accessToken ? "Present" : "Missing",
          refreshToken: data.refreshToken ? "Present" : "Missing",
        });

        dispatch(
          setAuth({
            user: data.user,
            tokens: {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            },
          })
        );

        console.log("🔍 Auth state updated, redirecting...");

        // Redirect based on user role
        if (data.user.isAdmin) {
          console.log("🔍 Redirecting to admin page");
          window.location.href = "/admin";
        } else if (data.user.role === "delivery") {
          console.log("🔍 Redirecting to delivery page");
          // Check if delivery boy has selfie uploaded
          checkDeliverySelfie(data.accessToken);
        } else {
          console.log("🔍 Redirecting to homepage");
          window.location.href = "/";
        }
      } else {
        const errorMessage = data.error || "OTP verification failed";
        if (errorMessage.includes("email already exists")) {
          setErrors({
            emailOrPhone:
              "An account with this email already exists. Please use a different email or try logging in.",
          });
        } else if (errorMessage.includes("phone number already exists")) {
          setErrors({
            emailOrPhone:
              "An account with this phone number already exists. Please use a different phone number or try logging in.",
          });
        } else {
          setErrors({ general: errorMessage });
        }
      }
    } catch (error) {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSuccess = (data: any) => {
    dispatch(
      setAuth({
        user: data.user,
        tokens: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      })
    );
    // Redirect based on user role
    if (data.user.isAdmin) {
      window.location.href = "/admin";
    } else if (data.user.role === "delivery") {
      // Check if delivery boy has selfie uploaded
      checkDeliverySelfie(data.accessToken);
    } else {
      window.location.href = "/";
    }
  };

  const handleOAuthError = (error: string) => {
    setErrors({ general: error });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md"
    >
      <h2 className="text-2xl font-bold text-center mb-6">Sign In</h2>

      {/* OAuth Login */}
      <div className="mb-6">
        <OAuthLogin onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">
            Or continue with OTP
          </span>
        </div>
      </div>

      <form
        onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
        className="mt-6 space-y-4"
      >
        {/* Email/Phone Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email or Phone Number
          </label>
          <input
            type="text"
            name="emailOrPhone"
            value={formData.emailOrPhone}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email or phone number"
            disabled={otpSent}
          />
          {errors.emailOrPhone && (
            <p className="text-red-500 text-sm mt-1">{errors.emailOrPhone}</p>
          )}
        </div>

        {/* OTP Input - Only show after OTP is sent */}
        {otpSent && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              OTP
            </label>
            <input
              type="text"
              name="otp"
              value={formData.otp}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the 6-digit OTP"
              maxLength={6}
            />
            {errors.otp && (
              <p className="text-red-500 text-sm mt-1">{errors.otp}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              OTP sent to {formData.emailOrPhone}
            </p>
          </div>
        )}

        {/* General Error */}
        {errors.general && (
          <div className="text-red-600 text-sm mb-3">
            {errors.general}
            {errors.general.includes("User doesn't exist") && (
              <div className="mt-2">
                <a
                  href="/signup"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors inline-block"
                >
                  Sign Up Now
                </a>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading
            ? otpSent
              ? "Verifying OTP..."
              : "Sending OTP..."
            : otpSent
            ? "Verify OTP"
            : "Send OTP"}
        </button>

        {/* Resend OTP Button */}
        {otpSent && (
          <button
            type="button"
            onClick={() => {
              setOtpSent(false);
              setFormData((prev) => ({ ...prev, otp: "" }));
              setErrors({});
            }}
            className="w-full text-blue-600 text-sm py-2 hover:text-blue-700"
          >
            Use different email or phone number
          </button>
        )}
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{" "}
          <a href="/signup" className="text-blue-600 hover:text-blue-500">
            Sign up
          </a>
        </p>
      </div>
    </motion.div>
  );
};

export default LoginForm;
