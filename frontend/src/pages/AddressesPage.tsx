import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "../store";
import { setUser } from "../store/slices/authSlice";
import { useToast } from "../components/AccessibleToast";
import { Plus, MapPin, Phone, User } from "lucide-react";
import {
  validatePincode,
  getDeliveryStatusMessage,
  isPincodeDeliverable,
} from "../utils/pincodeValidation";
import {
  useGetAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
} from "../store/api";

interface Address {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  label: string;
  isDefault: boolean;
}

const AddressesPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useToast();
  const auth = useSelector((state: RootState) => state.auth);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!auth.isAuthenticated) {
      showError("Please log in to manage your addresses");
      navigate("/login", { replace: true });
    }
  }, [auth.isAuthenticated, navigate, showError]);

  // API hooks
  const {
    data: apiAddresses,
    isLoading: isLoadingAddresses,
    error: addressesError,
    refetch: refetchAddresses,
  } = useGetAddressesQuery(undefined, {
    skip: !auth.isAuthenticated,
  });

  const [addAddressMutation] = useAddAddressMutation();
  const [updateAddressMutation] = useUpdateAddressMutation();
  const [deleteAddressMutation] = useDeleteAddressMutation();
  const [setDefaultAddressMutation] = useSetDefaultAddressMutation();

  // Addresses are now loaded from backend API only

  // Load addresses from MongoDB backend API only
  const [addresses, setAddresses] = useState<Address[]>([]);

  // Update addresses when API data changes
  useEffect(() => {
    if (auth.isAuthenticated) {
      // API now returns { addresses: [...], defaultAddressId: "xxx" }
      const addressArray = apiAddresses?.addresses || [];
      
      if (addressArray.length > 0) {
        // Convert API addresses to local format
        const convertedAddresses = addressArray.map((addr: any) => ({
          id: addr._id || addr.id,
          name: addr.name || "User",
          address: addr.addressLine,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          phone: addr.phone || "",
          label: addr.label,
          isDefault: addr.isDefault,
        }));
        setAddresses(convertedAddresses);
      } else {
        // If authenticated but no API data, show empty state
        setAddresses([]);
      }
    }
  }, [apiAddresses, auth.isAuthenticated]);

  // Listen for address updates - refetch from backend
  useEffect(() => {
    const handleAddressesUpdated = () => {
      refetchAddresses();
    };

    window.addEventListener("addressesUpdated", handleAddressesUpdated);

    return () => {
      window.removeEventListener("addressesUpdated", handleAddressesUpdated);
    };
  }, [refetchAddresses]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [autoFillData, setAutoFillData] = useState<Partial<Address> | null>(null);

  // Check for autofill data from location detection
  useEffect(() => {
    const autofillData = localStorage.getItem("autofillAddress");
    if (autofillData) {
      try {
        const locationData = JSON.parse(autofillData);
        setAutoFillData({
          address: locationData.addressLine || "",
          city: locationData.city || "",
          state: locationData.state || "",
          pincode: locationData.pincode || "",
        });
        setShowAddForm(true); // Auto-open form with pre-filled data
        localStorage.removeItem("autofillAddress"); // Clear after use
      } catch (error) {
        console.error("Failed to parse autofill data:", error);
      }
    }
  }, []);

  // MongoDB is now the single source of truth - no localStorage saving needed

  const handleSetDefault = async (addressId: string) => {
    try {
      // Use backend API to set default address
      await setDefaultAddressMutation(addressId).unwrap();
      await refetchAddresses(); // Refresh addresses from MongoDB

      // Update Redux store
      if (auth.user) {
        const updatedUser = {
          ...auth.user,
          addresses: addresses.map((addr) => ({
            ...addr,
            isDefault: addr.id === addressId,
          })),
        };
        dispatch(setUser(updatedUser));
      }

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("addressesUpdated"));
      
      showSuccess("Default address updated successfully!");
    } catch (error) {
      console.error("Error setting default address:", error);
      showError("Failed to set default address");
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setShowAddForm(true);
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      // Use backend API to delete address
      const result = await deleteAddressMutation(addressId).unwrap();
      
      // Refresh addresses from MongoDB
      await refetchAddresses();

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("addressesUpdated"));
      
      // Show appropriate success message
      if (result.defaultUpdated) {
        showSuccess("Address removed successfully. Default address updated.");
      } else {
        showSuccess("Address removed successfully!");
      }
    } catch (error) {
      console.error("Error deleting address:", error);
      showError("Failed to delete address");
    }
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setAutoFillData(null);
    setShowAddForm(true);
  };

  const handleLocationDetected = (locationData: Partial<Address>) => {
    setAutoFillData(locationData);
    setEditingAddress(null);
    setShowAddForm(true);
  };

  // Improved filtering logic as per requirements
  const allAddresses = addresses || [];
  const defaultAddress = allAddresses.find(addr => addr.isDefault) || null;
  const otherAddresses = allAddresses.filter(addr => !addr.isDefault);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar - Account Menu */}
          <div className="w-64 bg-white rounded-lg shadow-sm p-6 h-fit">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Account
            </h2>

            <div className="space-y-1">
              <div className="text-sm text-gray-600 mb-4">Overview</div>

              <div className="text-sm text-gray-600 mb-2">ORDERS</div>
              <div className="ml-4 space-y-1">
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Orders & Returns
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-2 mt-4">CREDITS</div>
              <div className="ml-4 space-y-1">
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Coupons
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  CS Store Credit
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  CS Store Cash
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-2 mt-4">ACCOUNT</div>
              <div className="ml-4 space-y-1">
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Profile
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Saved Cards
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Saved UPI
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Saved Wallets/BNPL
                </div>
                <div className="text-sm text-blue-600 font-medium py-1">
                  Addresses
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  CS Store Insider
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Delete Account
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-2 mt-4">LEGAL</div>
              <div className="ml-4 space-y-1">
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Terms of Use
                </div>
                <div className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer py-1">
                  Privacy Center
                </div>
              </div>
            </div>
          </div>

          {/* Right Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Saved Addresses
                </h1>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      // Inline the Use Current Location logic
                      try {
                        if (!navigator.geolocation) {
                          showError("Geolocation is not supported by your browser");
                          return;
                        }

                        navigator.geolocation.getCurrentPosition(
                          async (position) => {
                            const { latitude, longitude } = position.coords;
                            try {
                              const response = await fetch(
                                `/api/location/reverse-geocode?lat=${latitude}&lng=${longitude}`
                              );
                              const data = await response.json();
                              
                              if (data.success && data.data) {
                                const detectedState = data.data.state || "";
                                const detectedPincode = data.data.pincode || "";
                                
                                console.log("Detected State:", detectedState);
                                console.log("Detected Pincode:", detectedPincode);
                                
                                // Validate if state is Andhra Pradesh or Telangana
                                const validStates = ["andhra pradesh", "telangana"];
                                const isValidState = validStates.some(state => 
                                  detectedState.toLowerCase().includes(state)
                                );
                                
                                // Also validate pincode if available
                                const isValidPincode = detectedPincode ? 
                                  isPincodeDeliverable(detectedPincode) : false;
                                
                                console.log("Is Valid State:", isValidState);
                                console.log("Is Valid Pincode:", isValidPincode);
                                
                                if (!isValidState && !isValidPincode) {
                                  const errorMsg = `Delivery not available for ${detectedState || "your location"}. We only deliver to Andhra Pradesh and Telangana.`;
                                  console.log("Showing error:", errorMsg);
                                  showError(errorMsg);
                                  alert(errorMsg); // Fallback alert
                                  return;
                                }
                                
                                handleLocationDetected({
                                  name: "",
                                  address: data.data.address || "",
                                  city: data.data.city || "",
                                  state: detectedState,
                                  pincode: detectedPincode,
                                  phone: "",
                                  label: "Home",
                                });
                                showSuccess("Location detected successfully!");
                              } else {
                                showError("Could not determine your location");
                              }
                            } catch (error) {
                              console.error("Reverse geocoding failed:", error);
                              showError("Could not determine your location");
                            }
                          },
                          (error) => {
                            let errorMessage = "Could not access your location";
                            if (error.code === error.PERMISSION_DENIED) {
                              errorMessage = "Please allow location access and try again";
                            }
                            showError(errorMessage);
                          }
                        );
                      } catch (error) {
                        showError("Could not access your location");
                      }
                    }}
                    className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    USE CURRENT LOCATION
                  </button>
                  <button
                    onClick={handleAddAddress}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    ADD NEW ADDRESS
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isLoadingAddresses && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading addresses...</p>
                </div>
              )}

              {/* Error State */}
              {addressesError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-800">Failed to load addresses. Please try again.</p>
                </div>
              )}

              {/* Default Address Section */}
              {defaultAddress && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 uppercase">
                    Default Address
                  </h2>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-900">
                            {defaultAddress.name}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                          <div className="text-gray-700">
                            <div>{defaultAddress.address}</div>
                            <div>
                              {defaultAddress.city} - {defaultAddress.pincode},{" "}
                              {defaultAddress.state}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-600" />
                          <span className="text-gray-700">
                            {defaultAddress.phone}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleEditAddress(defaultAddress)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          EDIT
                        </button>
                        <div className="w-px bg-gray-300"></div>
                        <button
                          onClick={() => handleDeleteAddress(defaultAddress.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          REMOVE
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Other Addresses Section */}
              {otherAddresses.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4 uppercase">
                    Other Addresses
                  </h2>
                  <div className="space-y-4">
                    {otherAddresses.map((address) => (
                      <div
                        key={address.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="w-4 h-4 text-gray-600" />
                              <span className="font-medium text-gray-900">
                                {address.name}
                              </span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {address.label}
                              </span>
                            </div>
                            <div className="flex items-start gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                              <div className="text-gray-700">
                                <div>{address.address}</div>
                                <div>
                                  {address.city} - {address.pincode},{" "}
                                  {address.state}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-600" />
                              <span className="text-gray-700">
                                {address.phone}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <button
                              onClick={() => handleSetDefault(address.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              SET AS DEFAULT
                            </button>
                            <button
                              onClick={() => handleEditAddress(address)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              EDIT
                            </button>
                            <div className="w-px bg-gray-300"></div>
                            <button
                              onClick={() => handleDeleteAddress(address.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              REMOVE
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add/Edit Form Modal */}
              {showAddForm && (
                <AddressForm
                  address={editingAddress}
                  autoFillData={autoFillData}
                  onClose={() => {
                    setShowAddForm(false);
                    setEditingAddress(null);
                    setAutoFillData(null);
                  }}
                  onSave={async (newAddress) => {
                    try {
                      // Prepare address data for backend API
                      // Note: lat/lng will be auto-generated by backend geocoding
                      const addressData = {
                        name: newAddress.name,
                        label: newAddress.label,
                        pincode: newAddress.pincode,
                        city: newAddress.city,
                        state: newAddress.state,
                        addressLine: newAddress.address,
                        phone: newAddress.phone,
                        isDefault: addresses.length === 0 ? true : false, // First address is default
                      };

                      if (editingAddress) {
                        // Update existing address via backend API
                        await updateAddressMutation({
                          addressId: editingAddress.id,
                          ...addressData,
                        }).unwrap();
                      } else {
                        // Add new address via backend API
                        await addAddressMutation(addressData).unwrap();
                      }

                      // Refresh addresses from MongoDB
                      await refetchAddresses();

                      // Dispatch custom event to notify other components
                      window.dispatchEvent(new CustomEvent("addressesUpdated"));
                      setShowAddForm(false);
                      setEditingAddress(null);
                      showSuccess(
                        editingAddress
                          ? "Address updated successfully!"
                          : "Address added successfully!"
                      );
                    } catch (error: any) {
                      console.error("❌ Error saving address to backend:", error);
                      showError(
                        error?.data?.message || 
                        error?.message || 
                        "Failed to save address. Please try again."
                      );
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Address Form Component
interface AddressFormProps {
  address?: Address | null;
  autoFillData?: Partial<Address> | null;
  onClose: () => void;
  onSave: (address: Omit<Address, "id" | "isDefault">) => void;
}

const AddressForm: React.FC<AddressFormProps> = ({
  address,
  autoFillData,
  onClose,
  onSave,
}) => {
  // Priority: address (for editing) > autoFillData (from location) > empty
  const [formData, setFormData] = useState({
    name: address?.name || autoFillData?.name || "",
    address: address?.address || autoFillData?.address || "",
    city: address?.city || autoFillData?.city || "",
    state: address?.state || autoFillData?.state || "",
    pincode: address?.pincode || autoFillData?.pincode || "",
    phone: address?.phone || autoFillData?.phone || "",
    label: address?.label || autoFillData?.label || "HOME",
  });

  const [pincodeStatus, setPincodeStatus] = useState<{
    message: string;
    isValid: boolean;
    isDeliverable: boolean;
  }>({
    message: "",
    isValid: false,
    isDeliverable: false,
  });

  const handlePincodeChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const pincode = e.target.value;
    setFormData({ ...formData, pincode });

    if (pincode.length === 6) {
      // Show loading state
      setPincodeStatus({
        message: "Validating pincode...",
        isValid: false,
        isDeliverable: false,
      });

      try {
        // Validate pincode asynchronously
        const pincodeData = await validatePincode(pincode);

        if (pincodeData) {
          setPincodeStatus({
            message: getDeliveryStatusMessage(pincodeData),
            isValid: true,
            isDeliverable: pincodeData.isDeliverable,
          });
        } else {
          setPincodeStatus({
            message: "Please enter a valid 6-digit pincode",
            isValid: false,
            isDeliverable: false,
          });
        }
      } catch (error) {
        console.error("Error validating pincode:", error);
        setPincodeStatus({
          message: "Error validating pincode. Please try again.",
          isValid: false,
          isDeliverable: false,
        });
      }
    } else if (pincode.length > 0) {
      setPincodeStatus({
        message: "Pincode must be 6 digits",
        isValid: false,
        isDeliverable: false,
      });
    } else {
      setPincodeStatus({
        message: "",
        isValid: false,
        isDeliverable: false,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if pincode is deliverable before submitting
    if (formData.pincode && !isPincodeDeliverable(formData.pincode)) {
      return; // Don't submit if not deliverable
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {address ? "Edit Address" : "Add New Address"}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pincode <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={handlePincodeChange}
                maxLength={6}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  pincodeStatus.isValid && pincodeStatus.isDeliverable
                    ? "border-green-500"
                    : pincodeStatus.isValid && !pincodeStatus.isDeliverable
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                required
              />
              {pincodeStatus.message && (
                <p
                  className={`text-sm mt-1 ${
                    pincodeStatus.isValid && pincodeStatus.isDeliverable
                      ? "text-green-600"
                      : pincodeStatus.isValid && !pincodeStatus.isDeliverable
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {pincodeStatus.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="HOME">Home</option>
                <option value="OFFICE">Office</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !!(formData.pincode && !isPincodeDeliverable(formData.pincode))
                }
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  formData.pincode && !isPincodeDeliverable(formData.pincode)
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {address ? "Update Address" : "Add Address"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddressesPage;
