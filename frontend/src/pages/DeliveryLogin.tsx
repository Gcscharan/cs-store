import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-hot-toast";
import { Package, Mail, Lock, AlertCircle } from "lucide-react";
import { setUser, setTokens } from "../store/slices/authSlice";

const DeliveryLogin: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/delivery/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.status === "pending") {
          setErrorMessage(
            "Your account is awaiting admin approval. You'll be notified once approved."
          );
        } else if (data.status === "suspended") {
          setErrorMessage(
            "Your account has been suspended. Please contact support."
          );
        } else {
          setErrorMessage(data.error || "Login failed");
        }
        return;
      }

      // Store auth data
      dispatch(setUser(data.user));
      dispatch(setTokens(data.tokens));

      toast.success("Login successful!");
      navigate("/delivery/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      setErrorMessage(error.message || "Failed to login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              <Package className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Delivery Partner Login
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to start delivering
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{errorMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Signup Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            New to delivery?{" "}
            <button
              onClick={() => navigate("/delivery/signup")}
              className="text-blue-600 font-semibold hover:underline"
            >
              Sign up here
            </button>
          </p>
        </div>

        {/* Customer Login Link */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Not a delivery partner?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-gray-700 font-semibold hover:underline"
            >
              Customer Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeliveryLogin;
