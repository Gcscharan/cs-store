import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Mail, Phone } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "../store";
import { setUser } from "../store/slices/authSlice";
import { useLanguage } from "../contexts/LanguageContext";
import { useGetProfileQuery, useUpdateProfileMutation } from "../store/api";
import toast from "react-hot-toast";

const EditProfilePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  
  // Fetch fresh profile data from MongoDB
  const { data: fetchedProfile, refetch: refetchProfile } = useGetProfileQuery(undefined, {
    skip: !isAuthenticated,
  });
  
  // Use mutation for updating profile
  const [updateProfileMutation, { isLoading: isUpdating }] = useUpdateProfileMutation();
  
  const { t } = useLanguage();
  
  // Initialize profile data from fetched MongoDB data
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Update profile data when MongoDB data loads
  useEffect(() => {
    if (fetchedProfile) {
      setProfileData({
        name: fetchedProfile.name || "",
        email: fetchedProfile.email || "",
        phone: fetchedProfile.phone || "",
      });
    }
  }, [fetchedProfile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/account");
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (field: keyof typeof profileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProfileUpdate = async () => {
    if (!profileData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!profileData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    try {
      // Update profile via MongoDB API
      const result = await updateProfileMutation(profileData).unwrap();
      
      // Update Redux store with fresh data
      if (result.user) {
        dispatch(setUser(result.user));
      }
      
      // Refetch profile to ensure UI is in sync
      await refetchProfile();
      
      toast.success("Profile updated successfully!");
      navigate("/account");
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast.error(error?.data?.error || "Failed to update profile. Please try again.");
    }
  };

  const handleCancel = () => {
    navigate("/account");
  };

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white py-4 px-4 shadow-sm sticky top-0 z-10"
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Edit Personal Information
              </h1>
              <p className="text-sm text-gray-600">
                Update your profile details
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Form Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="py-6 px-4"
      >
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Profile Form */}
            <div className="space-y-6">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span>{t("profile.name")}</span>
                  </div>
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{t("profile.email")}</span>
                  </div>
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{t("profile.phone")}</span>
                  </div>
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your phone number"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleProfileUpdate}
                disabled={isUpdating}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isUpdating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  t("profile.save")
                )}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancel}
                disabled={isUpdating}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {t("profile.cancel")}
              </motion.button>
            </div>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Your profile information helps us provide better service. 
                Make sure your email and phone number are accurate for order updates and delivery notifications.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EditProfilePage;
