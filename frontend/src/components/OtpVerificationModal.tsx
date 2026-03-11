import React, { useEffect, useState } from "react";
import { X, ShieldCheck, Loader2, RefreshCcw } from "lucide-react";
import { useDispatch } from "react-redux";
import { setUser, setTokens } from "../store/slices/authSlice";
import { toApiUrl } from "../config/runtime";
import { useLanguage } from "../contexts/LanguageContext";

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified?: () => void;
  phone?: string;
  pendingUserId?: string;
}

const COOLDOWN_SECONDS = 60;

const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({ 
  isOpen, 
  onClose, 
  onVerified, 
  phone, 
  pendingUserId 
}) => {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Start cooldown when modal opens (initial OTP already requested at signup)
  useEffect(() => {
    if (!isOpen) return;
    setCooldown(COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError(t("otp.enterSixDigit"));
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      // For authenticated users, only send OTP
      // For unauthenticated users, send OTP, phone, and pendingUserId
      const requestBody: any = { otp };
      
      if (!localStorage.getItem("accessToken") && phone) {
        // Unauthenticated flow - include phone and pendingUserId
        requestBody.phone = phone;
        requestBody.pendingUserId = pendingUserId;
      }

      const response = await fetch(toApiUrl("/users/verify-mobile"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.message || "Failed to verify mobile number";
        
        // Show specific error messages
        if (errorMessage.includes("not found") || errorMessage.includes("expired")) {
          setError(t("otp.notFoundOrExpired"));
        } else if (errorMessage.includes("Invalid OTP")) {
          setError(t("otp.invalidOtp", { attempts: data.attemptsRemaining }));
        } else if (errorMessage.includes("Maximum OTP attempts exceeded")) {
          setError(t("otp.maxAttemptsExceeded"));
        } else {
          setError(errorMessage);
        }
        return;
      }

      // Update Redux and localStorage with new tokens and user
      if (data.accessToken && data.refreshToken) {
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      if (data.user) {
        dispatch(setUser({
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          isAdmin: data.user.isAdmin,
        }));
        dispatch(setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }));
      } else if (data.accessToken && data.refreshToken) {
        dispatch(setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }));
      }

      // Success: mark verified and redirect
      if (onVerified) onVerified();
      onClose();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsResending(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch(toApiUrl("/otp/verification/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to resend OTP");
        return;
      }

      setInfo(t("otp.otpResentSuccess"));
      // Restart cooldown
      setCooldown(COOLDOWN_SECONDS);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label={t("ui.close")}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold">{t("otp.verifyMobile")}</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t("otp.otpSentMessage")}
        </p>

        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg"
          placeholder={t("otp.enterOtp")}
          maxLength={6}
        />

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        {info && <p className="text-green-600 text-sm mt-2">{info}</p>}

        <button
          onClick={handleVerify}
          disabled={isLoading}
          className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> {t("otp.verifying")}</span>
          ) : (
            t("ui.verify")
          )}
        </button>

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className={`inline-flex items-center text-sm ${cooldown > 0 || isResending ? "text-gray-400 cursor-not-allowed" : "text-blue-600 hover:text-blue-700"}`}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            {isResending ? t("otp.resending") : t("otp.resendOtp")}
          </button>
          <span className="text-xs text-gray-500">
            {cooldown > 0 ? t("otp.canResendIn", { seconds: String(cooldown) }) : t("otp.canResendNow")}
          </span>
        </div>

        <p className="text-xs text-gray-500 mt-3">{t("otp.didntReceiveOtp")}</p>
      </div>
    </div>
  );
};

export default OtpVerificationModal;