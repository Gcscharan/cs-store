import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { motion } from "framer-motion";
import { setAuth } from "../store/slices/authSlice";

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
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        dispatch(
          setAuth({
            user: data.user,
            tokens: {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            },
          })
        );
        // Redirect to home or dashboard
        window.location.href = "/";
      } else {
        // Handle specific error messages
        const errorMessage = data.error || "Signup failed";

        // Check if it's an email or phone conflict
        if (errorMessage.includes("email already exists")) {
          setErrors({ email: "An account with this email already exists" });
        } else if (errorMessage.includes("phone number already exists")) {
          setErrors({
            phone: "An account with this phone number already exists",
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md"
    >
      <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

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
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mobile Number
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className={`mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.phone
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            }`}
            placeholder="Enter your 10-digit mobile number"
            maxLength={10}
          />
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
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
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* General Error */}
        {errors.general && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {errors.general}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:text-blue-500">
            Sign in
          </a>
        </p>
      </div>
    </motion.div>
  );
};

export default SignupForm;
