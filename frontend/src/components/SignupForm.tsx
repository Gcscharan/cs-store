import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { setUser, setTokens } from "../store/slices/authSlice";
import { toApiUrl } from "../config/runtime";

interface SignupFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface PrefilledCredentials {
  emailOrPhone?: string;
  fromLogin?: boolean;
}

interface SignupFormProps {
  prefilledCredentials?: PrefilledCredentials | null;
}

const SignupForm: React.FC<SignupFormProps> = ({ prefilledCredentials }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginInfo, setLoginInfo] = useState<string | null>(null);

  // OTP states (minimal / focused)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [phoneOtpVerified, setPhoneOtpVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(30);
  const [canResendOtp, setCanResendOtp] = useState(false);

  // Helper function to detect if input is phone or email
  const detectInputType = (input: string): "phone" | "email" => {
    const phoneRegex = /^[0-9]{10,12}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (phoneRegex.test(input)) return "phone";
    if (emailRegex.test(input)) return "email";
    return "email"; // Default to email if unclear
  };

  // Handle credential pre-filling from login redirect
  useEffect(() => {
    if (prefilledCredentials?.emailOrPhone) {
      console.log("🔄 SIGNUP FORM: Pre-filling credentials:", prefilledCredentials.emailOrPhone);

      const inputType = detectInputType(prefilledCredentials.emailOrPhone);

      setFormData(prev => ({
        ...prev,
        [inputType]: prefilledCredentials.emailOrPhone || ""
      }));

      console.log(`✅ SIGNUP FORM: Pre-filled ${inputType} field with:`, prefilledCredentials.emailOrPhone);
    }
  }, [prefilledCredentials]);

  // Mobile number validation function
  const isValidPhoneNumber = (number: string): boolean => {
    return /^[6-9]\d{9}$/.test(number);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "phone") {
      // Format phone number as user types (limit to 10 digits)
      const phoneDigits = value.replace(/\D/g, "").slice(0, 10);

      // If phone changed, reset OTP states (so UI matches your requirement)
      setPhoneOtpSent(false);
      setPhoneOtp("");
      setPhoneOtpVerified(false);
      setOtpError("");

      setFormData((prev) => ({ ...prev, [name]: phoneDigits }));

      // Clear phone error when user starts typing
      if (errors.phone) {
        setErrors((prev) => ({ ...prev, phone: "" }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.phone.trim()) {
      newErrors.phone = "Please enter your mobile number";
    } else if (!isValidPhoneNumber(formData.phone)) {
      newErrors.phone =
        "Invalid number. Enter a 10-digit number starting with 6–9.";
    }
    if (!formData.password) newErrors.password = "Password is required";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------------------------
  // OTP: Send & Verify handlers
  // ---------------------------

  const handleSendPhoneOtp = async () => {
    // Basic guard: valid phone
    if (!formData.phone || !isValidPhoneNumber(formData.phone)) {
      setOtpError("Please enter a valid 10-digit mobile number");
      return;
    }

    try {
      setIsOtpLoading(true);
      setOtpError("");

      // IMPORTANT: do not send OTP if phone is already registered
      const checkResponse = await fetch(
        toApiUrl("/auth/check-phone"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: formData.phone.replace(/\D/g, "") }),
        }
      );

      const checkData = await checkResponse.json();

      if (checkResponse.ok && checkData?.exists) {
        const errorMsg =
          "This phone number is already registered. Please sign in or use a different number.";
        setOtpError("");
        setErrors((prev) => ({ ...prev, phone: errorMsg }));
        setPhoneOtpSent(false);
        return;
      }

      const response = await fetch(
        toApiUrl("/auth/send-otp?mode=signup"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: formData.phone.replace(/\D/g, "") }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Show backend error message if present
        throw new Error(data.error || data.message || "Failed to send OTP");
      }

      // Mark OTP as sent — display OTP input UI
      setPhoneOtpSent(true);
      setOtpError("");
      setOtpTimer(30);
      setCanResendOtp(false);

      const interval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanResendOtp(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send OTP");
      setPhoneOtpSent(false);
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    // guard
    if (!phoneOtp || phoneOtp.length !== 6) {
      setOtpError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setIsOtpLoading(true);
      setOtpError("");

      const response = await fetch(
        toApiUrl("/auth/verify-otp?mode=signup"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            otp: phoneOtp,
            phone: formData.phone.replace(/\D/g, ""),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // verification failed
        throw new Error(data.error || data.message || "OTP verification failed");
      }

      // success
      setPhoneOtpVerified(true);
      setOtpError("");
    } catch (err) {
      setPhoneOtpVerified(false);
      setOtpError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setIsOtpLoading(false);
    }
  };

  // ---------------------------
  // Signup submit
  // ---------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return;

    if (!validateForm()) return;

    // If a phone is provided, require OTP verification
    if (formData.phone && !phoneOtpVerified) {
      setOtpError("Please verify your mobile number with OTP first");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        toApiUrl(`/auth/signup?t=${Date.now()}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // CASE A: Backend returned tokens (auto-login)
        const accessToken = data.accessToken || data.token || null;
        const refreshToken = data.refreshToken || data.refresh_token || null;

        if (accessToken) {
          dispatch(setUser(data.user));
          dispatch(setTokens({
            accessToken,
            refreshToken,
          }));

          localStorage.setItem("accessToken", accessToken);
          if (refreshToken) localStorage.setItem("refreshToken", refreshToken);

          // TRY OTP generation (no modal) — best-effort
          try {
            fetch(toApiUrl("/otp/verification/generate"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ phone: formData.phone }),
            }).catch(() => {});
          } catch (_) {}

          setErrors({});
          setLoginInfo("Signup successful! Your account has been created.");

          // Redirect to dashboard after successful signup
          navigate("/dashboard");
        } else {
          // CASE B: Signup succeeded but NO tokens returned
          setErrors({});
          setLoginInfo("Account created successfully. Please log in to continue.");
        }
      } else {
        // ERROR HANDLING
        const errorMessage = data.error || data.message || "Signup failed";

        if (errorMessage.toLowerCase().includes("email") && errorMessage.toLowerCase().includes("exists")) {
          setErrors({ email: "An account with this email already exists" });
        } else if (errorMessage.toLowerCase().includes("phone") && errorMessage.toLowerCase().includes("exists")) {
          setErrors({ phone: "An account with this phone number already exists" });
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md"
    >
      <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

      {loginInfo && (
        <p className="text-blue-600 text-sm mb-3">{loginInfo}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your name"
            disabled={isLoading || isOtpLoading}
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email"
            disabled={isLoading || isOtpLoading}
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Phone + Verify button (inline) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mobile Number
          </label>

          <div className="flex gap-2 mt-1 items-center">
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errors.phone
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              placeholder="Enter your 10-digit mobile number"
              maxLength={10}
              disabled={isLoading || isOtpLoading}
            />

            {/* Verify / Verified indicator button */}
            {phoneOtpVerified ? (
              <div
                aria-live="polite"
                className="inline-flex items-center px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm"
              >
                ✓ Verified
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSendPhoneOtp}
                disabled={!formData.phone || formData.phone.length !== 10 || isOtpLoading}
                className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md text-sm transition-colors"
              >
                {isOtpLoading && !phoneOtpSent ? "Sending..." : "Verify"}
              </button>
            )}
          </div>

          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
          )}

          {/* OTP input + Submit button (appears only after OTP is sent and not yet verified) */}
          {phoneOtpSent && !phoneOtpVerified && (
            <div className="flex gap-2 mt-3 items-center">
              <input
                type="text"
                inputMode="numeric"
                value={phoneOtp}
                onChange={(e) =>
                  setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                disabled={isOtpLoading || isLoading}
              />

              <button
                type="button"
                onClick={handleVerifyPhoneOtp}
                disabled={phoneOtp.length !== 6 || isOtpLoading}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
              >
                {isOtpLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          )}

          {/* RESEND BUTTON BETWEEN OTP AND PASSWORD */}
          {phoneOtpSent && !phoneOtpVerified && (
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                disabled={!canResendOtp}
                onClick={handleSendPhoneOtp}
                className={`text-sm font-medium transition-colors ${
                  canResendOtp
                    ? "text-blue-600 hover:text-blue-700 cursor-pointer"
                    : "text-gray-400 cursor-not-allowed"
                }`}
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                Resend OTP
              </button>
              <span className="text-sm text-gray-500">
                {canResendOtp ? "" : `Resend in ${otpTimer}s`}
              </span>
            </div>
          )}

          {/* OTP verification success/failure messages */}
          {phoneOtpVerified && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-700 text-sm font-medium">
                ✓ Mobile number verified successfully
              </p>
            </div>
          )}

          {otpError && !phoneOtpVerified && (
            <p className="text-red-500 text-sm mt-2">{otpError}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your password"
            disabled={isLoading || isOtpLoading}
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirm your password"
            disabled={isLoading || isOtpLoading}
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        {/* General Error */}
        {errors.general && (
          <p className="text-red-500 text-sm mt-1">{errors.general}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </motion.div>
  );
}

export default SignupForm;