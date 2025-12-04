import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Settings,
  Edit,
  Package,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

import { useGetProfileQuery } from "../store/api";
import SkeletonLoader from "../components/SkeletonLoader";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const navigate = useNavigate();

  const { 
    data: user, 
    isLoading, 
    isFetching, 
    error, 
    refetch 
  } = useGetProfileQuery(undefined);

  const loading = isLoading || isFetching;

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Profile refreshed successfully");
    } catch (err) {
      toast.error("Failed to refresh profile");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="mb-4">
            <ShieldCheck className="h-12 w-12 text-red-600 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to Load Profile</h2>
          <p className="text-gray-600 mb-4">
            {(error as any)?.data?.error || "Unable to load your profile information"}
          </p>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Personal Information
              </h2>
              <div className="space-y-4">
                <SkeletonLoader variant="text" width="50%" />
                <SkeletonLoader variant="text" width="40%" />
                <SkeletonLoader variant="text" width="60%" />
                <SkeletonLoader variant="rectangular" height={80} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 py-8 px-4"
    >
      <div className="max-w-3xl mx-auto">
        {/* Page Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
          {/* Avatar Section */}
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user?.name || 'User'}</h2>
              <p className="text-gray-600">{user?.email || 'No email'}</p>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Personal Information
            </h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-medium">{user?.name || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-500">Email Address</p>
                  <p className="font-medium">{user?.email || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-500">Phone Number</p>
                  <p className="font-medium">{user?.phone || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={() => navigate('/account/profile/edit')}
              className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="edit-profile-button"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="flex-1 flex items-center justify-center space-x-2 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="flex-1 flex items-center justify-center space-x-2 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <Package className="h-4 w-4" />
              <span>My Orders</span>
            </button>
          </div>
        </div>

        {/* Account Status */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <div>
              <h4 className="font-semibold text-gray-900">Account Status</h4>
              <p className="text-sm text-gray-600">Your account is active and secure</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfilePage;