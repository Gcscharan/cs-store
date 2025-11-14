import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Calendar,
  MapPin,
  Navigation,
  Utensils,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  MessageCircle,
  Headphones,
  Edit3,
  ChevronRight,
  Star,
  Camera,
  Check,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRefreshTokenMutation } from "../store/api";
import { setAuth, logout } from "../store/slices/authSlice";

interface DeliveryProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  city?: string;
  zone?: string;
  orderCategory?: string;
  rating?: number;
  deId?: string;
}

const DeliveryProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const [refreshToken] = useRefreshTokenMutation();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    phone: "",
    joiningDate: "",
    city: "",
    zone: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Profile edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalSelfiePreview, setModalSelfiePreview] = useState<string | null>(
    null
  );
  const [isUploadingModalSelfie, setIsUploadingModalSelfie] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Language preferences state
  const [appLanguage, setAppLanguage] = useState("English");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [languageType, setLanguageType] = useState<"app" | "preferred">("app");
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);

  // Available language options
  const languageOptions = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "hi", name: "Hindi", flag: "🇮🇳" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
    { code: "pt", name: "Portuguese", flag: "🇵🇹" },
    { code: "ru", name: "Russian", flag: "🇷🇺" },
    { code: "ja", name: "Japanese", flag: "🇯🇵" },
    { code: "ko", name: "Korean", flag: "🇰🇷" },
    { code: "zh", name: "Chinese", flag: "🇨🇳" },
    { code: "ar", name: "Arabic", flag: "🇸🇦" },
  ];

  // Token refresh and error handling functions
  const handleTokenRefresh = async (): Promise<string | null> => {
    try {
      if (!tokens?.refreshToken) {
        console.error("No refresh token available");
        return null;
      }

      console.log("Attempting to refresh token...");
      const result = await refreshToken(tokens.refreshToken).unwrap();

      if (result.accessToken) {
        console.log("Token refreshed successfully");
        dispatch(
          setAuth({
            user: user!,
            tokens: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken || tokens.refreshToken,
            },
          })
        );
        return result.accessToken;
      }

      return null;
    } catch (error) {
      console.error("Token refresh failed:", error);
      // If refresh fails, logout the user
      dispatch(logout());
      navigate("/login");
      return null;
    }
  };

  const makeAuthenticatedRequest = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    let accessToken = tokens?.accessToken;

    if (!accessToken) {
      throw new Error("No access token available");
    }

    // Make the initial request
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // If we get a 403, try to refresh the token and retry
    if (response.status === 403) {
      console.log("Received 403, attempting token refresh...");
      const newToken = await handleTokenRefresh();

      if (newToken) {
        // Retry the request with the new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      } else {
        throw new Error("Token refresh failed");
      }
    }

    return response;
  };

  // Mock data for demonstration - replace with actual API call
  const mockProfile: DeliveryProfile = {
    id: "1",
    name: "JOHN DOE",
    email: "john.doe@example.com",
    phone: "+91 98765 43210",
    role: "delivery",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
    city: "Mumbai",
    zone: "Zone A",
    orderCategory: "Food & Grocery",
    rating: 4.8,
    deId: "DE123456",
  };

  useEffect(() => {
    console.log("DeliveryProfilePage useEffect - user:", user);
    console.log("DeliveryProfilePage useEffect - tokens:", tokens);

    if (!user || user.role !== "delivery") {
      console.log(
        "User not authenticated or not delivery role, redirecting to login"
      );
      navigate("/login");
      return;
    }

    if (!tokens?.accessToken) {
      console.log("No access token found, using mock data");
      setProfile(mockProfile);
      setIsLoading(false);
      return;
    }

    fetchProfile();
    fetchSelfieUrl();
  }, [user, navigate, tokens]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!tokens?.accessToken) {
        console.log("No access token for profile fetch, using mock data");
        setProfile(mockProfile);
        return;
      }

      console.log(
        "Fetching profile with token:",
        tokens.accessToken.substring(0, 20) + "..."
      );

      const response = await makeAuthenticatedRequest("/api/delivery/profile", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Profile response status:", response.status);

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
        } catch (parseError) {
          console.warn("Could not parse error response:", parseError);
        }

        console.error("Profile fetch failed:", errorMessage);
        setError(`Failed to load profile: ${errorMessage}`);
        // Fallback to mock data
        setProfile(mockProfile);
        return;
      }

      // Check if response has content before parsing JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn(
          "Profile response is not JSON, content-type:",
          contentType
        );
        setError("Invalid response format from server");
        setProfile(mockProfile);
        return;
      }

      const data = await response.json();
      console.log("Profile data:", data);
      setProfile(data);

      // Set language preferences if available
      if (data.appLanguage) {
        setAppLanguage(data.appLanguage);
      }
      if (data.preferredLanguage) {
        setPreferredLanguage(data.preferredLanguage);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(
        `Failed to load profile: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      // Fallback to mock data
      setProfile(mockProfile);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSelfieUrl = async () => {
    try {
      if (!tokens?.accessToken) {
        console.log("No access token for selfie URL fetch");
        return;
      }

      console.log(
        "Fetching selfie URL with token:",
        tokens.accessToken.substring(0, 20) + "..."
      );

      const response = await makeAuthenticatedRequest(
        "/api/delivery/selfie-url",
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Selfie URL response status:", response.status);

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
        } catch (parseError) {
          console.warn(
            "Could not parse error response for selfie URL:",
            parseError
          );
        }

        console.error(`Selfie URL fetch failed: ${errorMessage}`);
        return;
      }

      // Check if response has content before parsing JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn(
          "Selfie URL response is not JSON, content-type:",
          contentType
        );
        return;
      }

      const data = await response.json();
      console.log("Selfie URL data:", data);
      setSelfieUrl(data.selfieUrl);
    } catch (err) {
      console.error("Error fetching selfie URL:", err);
    }
  };

  const handleSelfieUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSelfieError("File size must be less than 5MB");
      return;
    }

    try {
      setIsUploadingSelfie(true);
      setSelfieError(null);

      const formData = new FormData();
      formData.append("selfie", file);

      console.log("Uploading selfie file:", file.name, "Size:", file.size);

      const response = await makeAuthenticatedRequest(
        "/api/delivery/update-selfie",
        {
          method: "PUT",
          // Don't set Content-Type header - let browser set it with boundary
          body: formData,
        }
      );

      console.log("Selfie upload response status:", response.status);

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
        } catch (parseError) {
          console.warn("Could not parse error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ Selfie uploaded successfully:", data);
      setSelfieUrl(data.selfieUrl);
    } catch (err) {
      console.error("❌ Selfie upload error:", err);
      setSelfieError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingSelfie(false);
    }
  };

  // Editing functions
  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValues((prev) => ({
      ...prev,
      [field]: currentValue,
    }));
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValues({
      phone: "",
      joiningDate: "",
      city: "",
      zone: "",
    });
  };

  const handleSave = async (field: string) => {
    if (!tokens?.accessToken) return;

    setIsUpdating(true);
    try {
      const updateData: any = {};

      // Map field names to API format
      switch (field) {
        case "phone":
          updateData.mobile = editValues.phone.replace(/\D/g, ""); // Remove non-digits
          break;
        case "joiningDate":
          updateData.joiningDate = editValues.joiningDate;
          break;
        case "city":
          updateData.city = editValues.city;
          break;
        case "zone":
          updateData.zone = editValues.zone;
          break;
      }

      const response = await makeAuthenticatedRequest("/api/delivery/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
        } catch (parseError) {
          console.warn("Could not parse error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      // Update local profile state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              [field === "phone" ? "phone" : field]:
                editValues[field as keyof typeof editValues],
              [field === "joiningDate" ? "createdAt" : field]:
                editValues[field as keyof typeof editValues],
            }
          : null
      );

      setEditingField(null);
      setEditValues({
        phone: "",
        joiningDate: "",
        city: "",
        zone: "",
      });
    } catch (err) {
      console.error("Update error:", err);
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (option === "App Language") {
      setLanguageType("app");
      setIsLanguageModalOpen(true);
    } else if (option === "Preferred Language") {
      setLanguageType("preferred");
      setIsLanguageModalOpen(true);
    } else {
      alert(`${option} feature coming soon!`);
    }
  };

  // Language handling functions
  const openLanguageModal = (type: "app" | "preferred") => {
    setLanguageType(type);
    setIsLanguageModalOpen(true);
  };

  const closeLanguageModal = () => {
    setIsLanguageModalOpen(false);
  };

  const handleLanguageSelect = async (language: string) => {
    if (!tokens?.accessToken) {
      alert("Please log in to update language preferences");
      return;
    }

    setIsUpdatingLanguage(true);
    try {
      const updateData = {
        [languageType === "app" ? "appLanguage" : "preferredLanguage"]:
          language,
      };

      const response = await makeAuthenticatedRequest("/api/delivery/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
        } catch (parseError) {
          console.warn("Could not parse error response:", parseError);
        }

        throw new Error(errorMessage);
      }

      // Check if response has content before parsing JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn(
          "Language update response is not JSON, content-type:",
          contentType
        );
        // Still update local state even if response is not JSON
      }

      // Update local state
      if (languageType === "app") {
        setAppLanguage(language);
      } else {
        setPreferredLanguage(language);
      }

      // Show success message
      alert(
        `${
          languageType === "app" ? "App" : "Preferred"
        } language updated to ${language}!`
      );
      closeLanguageModal();
    } catch (error) {
      console.error("Language update error:", error);
      alert(
        `Failed to update language: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

  // Modal functions
  const openModal = () => {
    setModalName(profile?.name || "JOHN DOE");
    setModalSelfiePreview(selfieUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalName("");
    setModalSelfiePreview(null);
  };

  const handleModalSelfieUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a valid image file (JPEG, JPG, PNG, WEBP)");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setModalSelfiePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const saveProfileChanges = async () => {
    if (!tokens?.accessToken) {
      alert("Please log in to update your profile");
      return;
    }

    setIsSavingProfile(true);
    const errors: string[] = [];

    try {
      // Update name if changed
      if (modalName !== profile?.name) {
        console.log("Updating profile name...");
        try {
          const response = await makeAuthenticatedRequest(
            "/api/delivery/profile",
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: modalName,
              }),
            }
          );

          if (!response.ok) {
            let errorMessage = `Server error: ${response.status}`;
            try {
              const errorText = await response.text();
              if (errorText) {
                const errorData = JSON.parse(errorText);
                errorMessage =
                  errorData.message || errorData.error || errorMessage;
              }
            } catch (parseError) {
              console.warn("Could not parse error response:", parseError);
            }
            throw new Error(errorMessage);
          }

          // Update local profile state
          setProfile((prev) => (prev ? { ...prev, name: modalName } : null));
          console.log("✅ Profile name updated successfully");
        } catch (error) {
          console.error("❌ Failed to update profile name:", error);
          errors.push(
            `Name update failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Upload selfie if changed
      if (modalSelfiePreview && modalSelfiePreview !== selfieUrl) {
        const fileInput = document.getElementById(
          "modal-selfie-upload"
        ) as HTMLInputElement;
        const file = fileInput?.files?.[0];

        if (file) {
          console.log("Uploading selfie file:", file.name, "Size:", file.size);

          // Validate file size (5MB limit)
          if (file.size > 5 * 1024 * 1024) {
            errors.push("Selfie file size must be less than 5MB");
          } else {
            try {
              const formData = new FormData();
              formData.append("selfie", file);

              console.log("Sending selfie upload request...");
              const response = await makeAuthenticatedRequest(
                "/api/delivery/update-selfie",
                {
                  method: "PUT",
                  // Don't set Content-Type header - let browser set it with boundary
                  body: formData,
                }
              );

              console.log("Selfie upload response status:", response.status);

              if (!response.ok) {
                let errorMessage = `Server error: ${response.status}`;
                try {
                  const errorText = await response.text();
                  if (errorText) {
                    const errorData = JSON.parse(errorText);
                    errorMessage =
                      errorData.message || errorData.error || errorMessage;
                  }
                } catch (parseError) {
                  console.warn("Could not parse error response:", parseError);
                }
                throw new Error(errorMessage);
              }

              const data = await response.json();
              console.log("✅ Selfie uploaded successfully:", data);
              setSelfieUrl(data.selfieUrl);
            } catch (error) {
              console.error("❌ Failed to upload selfie:", error);
              errors.push(
                `Selfie upload failed: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              );
            }
          }
        }
      }

      // Show appropriate success/error messages
      if (errors.length === 0) {
        alert("Profile updated successfully!");
        closeModal();
      } else if (errors.length === 1 && modalName === profile?.name) {
        // Only selfie failed, but name wasn't being updated
        alert(`Profile updated with warnings:\n${errors.join("\n")}`);
        closeModal();
      } else {
        // Multiple errors or name update failed
        alert(`Profile update failed:\n${errors.join("\n")}`);
      }
    } catch (error) {
      console.error("❌ Unexpected error updating profile:", error);
      alert(
        `Failed to update profile: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error display component
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Profile
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setError(null);
                fetchProfile();
              }}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/delivery")}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate("/delivery")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
          </div>
        </div>
      </div>

      <div className="px-3 py-4">
        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4"
        >
          <div className="flex items-start space-x-3">
            {/* Profile Photo */}
            <div
              className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer hover:from-orange-500 hover:to-orange-700 transition-all duration-200"
              onClick={openModal}
            >
              {selfieUrl ? (
                <img
                  src={selfieUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-white">
                  {profile?.name?.charAt(0) || "J"}
                </span>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center mb-1">
                <span className="text-xs text-gray-600">Your ratings → </span>
                <Star className="h-3 w-3 text-yellow-400 ml-1" />
                <span className="text-xs font-medium text-gray-900 ml-1">
                  {profile?.rating || "4.8"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {profile?.name || "JOHN DOE"}
              </h2>
              <p className="text-xs text-gray-500">
                DE ID: {profile?.deId || "DE123456"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Info Grid - Two Column Layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Mobile Number */}
              <div className="border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Mobile Number</p>
                    {editingField === "phone" ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="tel"
                          value={editValues.phone}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          className="text-sm font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full"
                          placeholder="Enter mobile number"
                        />
                        <button
                          onClick={() => handleSave("phone")}
                          disabled={isUpdating}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCancel()}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          {profile?.phone || "+91 98765 43210"}
                        </p>
                        <button
                          onClick={() =>
                            handleEdit(
                              "phone",
                              profile?.phone || "+91 98765 43210"
                            )
                          }
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Joining Date */}
              <div className="border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Joining Date</p>
                    {editingField === "joiningDate" ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="date"
                          value={editValues.joiningDate}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              joiningDate: e.target.value,
                            }))
                          }
                          className="text-sm font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full"
                        />
                        <button
                          onClick={() => handleSave("joiningDate")}
                          disabled={isUpdating}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCancel()}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          {profile?.createdAt
                            ? new Date(profile.createdAt).toLocaleDateString(
                                "en-GB"
                              )
                            : "15/01/2024"}
                        </p>
                        <button
                          onClick={() =>
                            handleEdit(
                              "joiningDate",
                              profile?.createdAt
                                ? new Date(profile.createdAt)
                                    .toISOString()
                                    .split("T")[0]
                                : "2024-01-15"
                            )
                          }
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Category */}
              <div className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Order Category</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        Food & Grocery
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* City */}
              <div className="border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">City</p>
                    {editingField === "city" ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editValues.city}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              city: e.target.value,
                            }))
                          }
                          className="text-sm font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full"
                          placeholder="Enter city"
                        />
                        <button
                          onClick={() => handleSave("city")}
                          disabled={isUpdating}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCancel()}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          {profile?.city || "Mumbai"}
                        </p>
                        <button
                          onClick={() =>
                            handleEdit("city", profile?.city || "Mumbai")
                          }
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Zone */}
              <div className="border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Zone</p>
                    {editingField === "zone" ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editValues.zone}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              zone: e.target.value,
                            }))
                          }
                          className="text-sm font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full"
                          placeholder="Enter zone"
                        />
                        <button
                          onClick={() => handleSave("zone")}
                          disabled={isUpdating}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCancel()}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          {profile?.zone || "Zone A"}
                        </p>
                        <button
                          onClick={() =>
                            handleEdit("zone", profile?.zone || "Zone A")
                          }
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Details Sections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-0.5"
        >
          {/* Emergency Details */}
          <button
            onClick={() => handleOptionClick("Emergency Details")}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <div className="p-1.5 bg-red-100 rounded-lg mr-3">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <span className="font-medium text-gray-900 text-sm">
                Emergency details
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>

          {/* Bank Details */}
          <button
            onClick={() => handleOptionClick("Bank Details")}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <div className="p-1.5 bg-blue-100 rounded-lg mr-3">
                <CreditCard className="h-4 w-4 text-blue-600" />
              </div>
              <span className="font-medium text-gray-900 text-sm">
                Bank details
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>

          {/* App Language */}
          <button
            onClick={() => handleOptionClick("App Language")}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <div className="p-1.5 bg-purple-100 rounded-lg mr-3">
                <MessageCircle className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex items-center justify-between flex-1">
                <span className="font-medium text-gray-900 text-sm">
                  App language
                </span>
                <span className="text-xs text-gray-500">{appLanguage}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>

          {/* Preferred Language */}
          <button
            onClick={() => handleOptionClick("Preferred Language")}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <div className="p-1.5 bg-orange-100 rounded-lg mr-3">
                <Headphones className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex items-center justify-between flex-1">
                <span className="font-medium text-gray-900 text-sm">
                  Preferred Language
                </span>
                <span className="text-xs text-gray-500">
                  {preferredLanguage}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        </motion.div>
      </div>

      {/* Profile Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Profile
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Profile Selfie Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Profile Selfie
                </label>
                <div className="text-center">
                  {modalSelfiePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={modalSelfiePreview}
                        alt="Profile preview"
                        className="w-24 h-24 object-cover rounded-full border-2 border-gray-200"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                      <Camera className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-2 mb-3">
                    {modalSelfiePreview
                      ? "Selfie uploaded"
                      : "No selfie uploaded yet"}
                  </p>
                  <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors cursor-pointer font-semibold">
                    <Camera className="h-4 w-4 mr-2" />
                    {modalSelfiePreview ? "Change Selfie" : "Upload Selfie"}
                    <input
                      id="modal-selfie-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleModalSelfieUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Name Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveProfileChanges}
                disabled={isSavingProfile}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingProfile ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Language Selection Modal */}
      {isLanguageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Select {languageType === "app" ? "App" : "Preferred"} Language
              </h3>
              <button
                onClick={closeLanguageModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Language Options */}
            <div className="max-h-96 overflow-y-auto p-4">
              <div className="space-y-2">
                {languageOptions.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageSelect(language.name)}
                    disabled={isUpdatingLanguage}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      (languageType === "app"
                        ? appLanguage
                        : preferredLanguage) === language.name
                        ? "bg-blue-50 border-blue-200 text-blue-900"
                        : "bg-white border-gray-200 hover:bg-gray-50 text-gray-900"
                    } ${
                      isUpdatingLanguage ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{language.flag}</span>
                      <span className="font-medium">{language.name}</span>
                    </div>
                    {(languageType === "app"
                      ? appLanguage
                      : preferredLanguage) === language.name && (
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-6 border-t border-gray-200">
              <button
                onClick={closeLanguageModal}
                disabled={isUpdatingLanguage}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DeliveryProfilePage;
