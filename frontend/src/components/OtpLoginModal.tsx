import React, { useState, useEffect } from "react";
import { X, Phone, Mail, User } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setUser, setTokens } from "../store/slices/authSlice";
import { RootState } from "../store";

interface OtpLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
}

type AuthMethod = "choose" | "phone" | "email" | "google";

const OtpLoginModal: React.FC<OtpLoginModalProps> = ({
  isOpen,
  onClose,
  redirectTo = "/account/profile",
}) => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("choose");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [otpTimer, setOtpTimer] = useState(30);
  const [canResendOtp, setCanResendOtp] = useState(false);

  // Auto-close modal if user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      console.log("OtpLoginModal: User authenticated, closing modal");
      onClose();
    }
  }, [isAuthenticated, isOpen, onClose]);

  // Mobile number validation function
  const isValidPhoneNumber = (number: string): boolean => {
    return /^[6-9]\d{9}$/.test(number);
  };

  const resetForm = () => {
    setPhone("");
    setEmail("");
    setOtp("");
    setError("");
    setPhoneError("");
    setOtpSent(false);
    setOtpTimer(30);
    setCanResendOtp(false);
    setAuthMethod("choose");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSendOtp = async () => {
    setIsLoading(true);
    setError("");
    setPhoneError("");

    try {
      // Build explicit payload
      let payload: any = {};
      if (phone) {
        // Validate phone number for Indian mobile numbers
        if (!isValidPhoneNumber(phone)) {
          setPhoneError("Please enter a valid 10-digit mobile number.");
          setIsLoading(false);
          return;
        }
        const phoneDigits = phone.replace(/\D/g, "");
        payload.phone = phoneDigits;
      } else if (email) {
        payload.email = email;
      } else {
        // Don't show error, just return without doing anything
        setIsLoading(false);
        return;
      }

      console.log("🔍 Sending OTP request payload:", payload);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/auth/send-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      console.log("🔍 send-otp status:", response.status);
      const data = await response.json();
      console.log("🔍 send-otp response body:", data);

      if (!response.ok) {
        // Handle account not found case
        if (response.status === 404 && data.action === "signup_required") {
          setError("Account does not exist. Please create an account.");
          return;
        }
        throw new Error(data.error || "Failed to send OTP");
      }

      // only set otpSent when the backend actually succeeded
      setOtpSent(true);
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
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/auth/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            otp,
            ...(phone ? { phone } : { email }),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error messages for duplicate accounts
        const errorMessage = data.error || "Failed to verify OTP";
        if (errorMessage.includes("email already exists")) {
          setError(
            "An account with this email already exists. Please use a different email or try logging in."
          );
        } else if (errorMessage.includes("phone number already exists")) {
          setError(
            "An account with this phone number already exists. Please use a different phone number or try logging in."
          );
        } else {
          setError(errorMessage);
        }
        return;
      }

      // Dispatch auth data to Redux store
      dispatch(setUser(data.user));
      dispatch(setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }));

      // Close modal and redirect based on user role
      handleClose();

      // Add longer delay to ensure Redux state is saved to localStorage before redirect
      setTimeout(() => {
        if (data.user.isAdmin) {
          window.location.href = "/admin";
        } else {
          // Don't redirect if we're already on the target page
          if (window.location.pathname !== redirectTo) {
            window.location.href = redirectTo;
          }
          // If we're already on the target page, just close the modal
          // The page will automatically update due to Redux state change
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    // Redirect to Google OAuth
    window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/auth/google`;
  };

  // Don't render modal if modal is not open
  if (!isOpen) {
    console.log("OtpLoginModal: Modal is closed, not rendering");
    return null;
  }

  console.log("OtpLoginModal: Modal is open, rendering");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-screen overflow-auto flex">
        {/* Left Panel - Modern Gradient Background */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-12 flex-1 flex flex-col justify-center relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full"></div>
            <div className="absolute top-32 right-16 w-24 h-24 bg-white rounded-full"></div>
            <div className="absolute bottom-20 left-20 w-16 h-16 bg-white rounded-full"></div>
            <div className="absolute bottom-32 right-10 w-20 h-20 bg-white rounded-full"></div>
          </div>

          <div className="text-center relative z-10">
            <div className="mb-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Welcome Back
              </h1>
              <p className="text-lg text-blue-100 leading-relaxed">
                Get access to your Orders and Recommendations
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-center space-x-2 text-blue-100">
                <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                <span className="text-sm">Secure Login</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-blue-100">
                <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                <span className="text-sm">Fast Checkout</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-blue-100">
                <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                <span className="text-sm">Personalized Experience</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Modern White Background */}
        <div className="bg-white p-12 flex-1 flex flex-col justify-center relative">
          {/* Put close button here so it is not inside the scrollable area */}
          <button
            onClick={handleClose}
            aria-label="Close login modal"
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full z-20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Scrollable content block */}
          <div className="w-full max-w-md mx-auto overflow-y-auto min-h-[360px]">
            {authMethod === "choose" && (
              <div className="space-y-6">
                {/* Heading */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In</h2>
                  <p className="text-gray-600">Enter your email or mobile number</p>
                </div>

                {/* Email/Phone Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={phone || email}
                    onChange={(e) => {
                      e.stopPropagation();
                      const value = e.target.value;
                      setPhoneError(""); // Clear error on input change

                      // Check if it contains @ symbol (definitely an email)
                      if (value.includes("@")) {
                        setEmail(value);
                        setPhone("");
                      }
                      // Check if it's only numbers and exactly 10 digits (phone number)
                      else if (/^[0-9]{10}$/.test(value)) {
                        setPhone(value);
                        setEmail("");
                      }
                      // Check if it's only numbers but not 10 digits yet (building phone number)
                      else if (/^[0-9]*$/.test(value) && value.length <= 10) {
                        setPhone(value);
                        setEmail("");
                      }
                      // Check if it contains letters or other characters (email or mixed)
                      else if (/^[a-zA-Z0-9@._-]*$/.test(value)) {
                        setEmail(value);
                        setPhone("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        const value = phone || email;
                        if (value) {
                          handleSendOtp();
                        }
                      }
                    }}
                    placeholder="Enter Email/Mobile number"
                    className={`w-full px-4 py-4 text-lg border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all ${
                      phoneError
                        ? "border-red-500 focus:border-red-500"
                        : "border-gray-200 focus:border-blue-500"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {phone ? (
                      <Phone className="h-5 w-5 text-gray-400" />
                    ) : email ? (
                      <Mail className="h-5 w-5 text-gray-400" />
                    ) : null}
                  </div>
                </div>

                {/* Phone validation error message */}
                {phoneError && (
                  <p className="text-red-500 text-sm mt-1">{phoneError}</p>
                )}

                {/* Error message for non-existent accounts */}
                {error && (
                  <div className="text-red-600 text-sm mb-3">
                    {error}
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  By continuing, you agree to CS Store's{" "}
                  <a href="/terms" className="text-blue-600 hover:underline">
                    Terms of Use
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                  .
                </div>

                {/* Request OTP button */}
                <button
                  onClick={() => {
                    const value = phone || email;
                    if (value) {
                      handleSendOtp();
                    }
                  }}
                  disabled={
                    Boolean(!phone && !email) || Boolean(phone && !isValidPhoneNumber(phone))
                  }
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                >
                  Continue
                </button>

                {/* OTP BLOCK – SHOW ONLY AFTER OTP IS SENT */}
                {otpSent && (
                  <>
                    <label className="text-gray-700 text-sm font-medium mt-4 block">Enter OTP</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="w-full px-4 py-3 border-2 rounded-lg border-gray-200 focus:outline-none focus:border-blue-500"
                      placeholder="Enter 6-digit OTP"
                    />

                    {/* RESEND TEXT BETWEEN OTP AND VERIFY */}
                    <div className="flex items-center justify-between mt-2">
                      <button
                        type="button"
                        disabled={!canResendOtp}
                        onClick={handleSendOtp}
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

                    <button
                      onClick={handleVerifyOtp}
                      disabled={otp.length !== 6 || isLoading}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg disabled:opacity-50"
                    >
                      {isLoading ? "Verifying..." : "Verify OTP"}
                    </button>
                  </>
                )}

                {/* ALWAYS VISIBLE BELOW REQUEST OTP */}
                <div className="relative mt-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">or</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleAuth}
                  className="w-full border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium py-4 px-6 rounded-lg transition-all flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="text-center text-sm text-gray-600 mt-4">
                  New to CS Store?{" "}
                  <button
                    onClick={() => window.location.href = "/signup"}
                    className="text-blue-600 font-medium hover:underline"
                  >
                    create an account.
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtpLoginModal;