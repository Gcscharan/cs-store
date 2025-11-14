import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Edit, Trash2, Check, X } from "lucide-react";
import AddressForm from "../components/AddressForm";
import PincodeAddressForm from "../components/PincodeAddressForm";
import {
  getSavedAddresses,
  deleteAddress,
  setDefaultAddress,
  Address,
} from "../utils/addressManager";
import { useToast } from "../components/AccessibleToast";

const AddressPage: React.FC = () => {
  const { success, error: showError } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showPincodeForm, setShowPincodeForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(
    null
  );

  // Load addresses on component mount
  useEffect(() => {
    const savedAddresses = getSavedAddresses();
    setAddresses(savedAddresses);
  }, []);

  // Autofill removed - all address data comes from MongoDB only
  // If location selection is needed, it should be passed via navigation state or query params

  // Handle new address added via pincode form
  const handlePincodeAddressAdded = (newAddress: Address) => {
    setAddresses((prev) => [...prev, newAddress]);
    setShowPincodeForm(false);
  };

  // Handle address save (new or edit)
  const handleAddressSave = (addressData: any) => {
    const { addAddress, updateAddress } = require("../utils/addressManager");

    if (editingAddress) {
      // Update existing address
      const updatedAddress = updateAddress(editingAddress.id, {
        ...addressData,
        id: editingAddress.id,
        createdAt: editingAddress.createdAt,
      });

      if (updatedAddress) {
        setAddresses((prev) =>
          prev.map((addr) =>
            addr.id === editingAddress.id ? updatedAddress : addr
          )
        );
        success(
          "Address updated",
          "Your address has been updated successfully."
        );
      }
    } else {
      // Add new address
      const newAddress = addAddress(addressData);
      setAddresses((prev) => [...prev, newAddress]);
      success("Address saved", "Your new address has been saved successfully.");
    }

    setShowAddressForm(false);
    setEditingAddress(null);
  };

  // Handle address edit
  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setShowAddressForm(true);
  };

  // Handle address delete
  const handleDeleteAddress = async (addressId: string) => {
    setDeletingAddressId(addressId);

    try {
      const deleted = deleteAddress(addressId);
      if (deleted) {
        setAddresses((prev) => prev.filter((addr) => addr.id !== addressId));
        success(
          "Address deleted",
          "The address has been deleted successfully."
        );
      } else {
        showError(
          "Delete failed",
          "Unable to delete the address. Please try again."
        );
      }
    } catch (error) {
      showError(
        "Delete failed",
        "An error occurred while deleting the address."
      );
    } finally {
      setDeletingAddressId(null);
    }
  };

  // Handle set as default
  const handleSetDefault = (addressId: string) => {
    const success = setDefaultAddress(addressId);
    if (success) {
      setAddresses((prev) =>
        prev.map((addr) => ({
          ...addr,
          isDefault: addr.id === addressId,
        }))
      );
      success(
        "Default address updated",
        "Your default address has been updated."
      );
    }
  };

  // Format address for display
  const formatAddress = (address: Address) => {
    return `${address.addressLine}, ${address.city}, ${address.state} - ${address.pincode}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-gray-50"
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Saved Addresses
          </h1>
          <p className="text-gray-600">Manage your delivery addresses</p>
        </div>

        {/* Addresses List */}
        {addresses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {addresses.map((address) => (
              <motion.div
                key={address.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative"
              >
                {/* Default Badge */}
                {address.isDefault && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      Default
                    </span>
                  </div>
                )}

                {/* Address Content */}
                <div className="mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {address.label}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formatAddress(address)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {!address.isDefault && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="flex-1 py-2 px-3 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Set Default
                    </button>
                  )}

                  <button
                    onClick={() => handleEditAddress(address)}
                    className="py-2 px-3 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteAddress(address.id)}
                    disabled={deletingAddressId === address.id}
                    className="py-2 px-3 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingAddressId === address.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No saved addresses
            </h3>
            <p className="text-gray-500 mb-6">
              Add your first address to get started
            </p>
          </div>
        )}

        {/* Add New Address Buttons */}
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Add with Pincode Button */}
            <button
              onClick={() => setShowPincodeForm(true)}
              className="flex items-center justify-center space-x-2 py-4 px-6 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <MapPin className="h-5 w-5" />
              <span>Add with Pincode</span>
            </button>

            {/* Add Manually Button */}
            <button
              onClick={() => setShowAddressForm(true)}
              className="flex items-center justify-center space-x-2 py-4 px-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Add Manually</span>
            </button>
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-sm text-gray-500">
              <strong>Add with Pincode:</strong> Enter your pincode to auto-fill
              city and state
              <br />
              <strong>Add Manually:</strong> Fill all address details manually
            </p>
          </div>
        </div>
      </div>

      {/* Address Form Modal */}
      {showAddressForm && (
        <AddressForm
          onClose={() => {
            setShowAddressForm(false);
            setEditingAddress(null);
          }}
          onSave={handleAddressSave}
        />
      )}

      {/* Pincode Address Form Modal */}
      {showPincodeForm && (
        <PincodeAddressForm
          onAddressAdded={handlePincodeAddressAdded}
          onClose={() => setShowPincodeForm(false)}
        />
      )}
    </motion.div>
  );
};

export default AddressPage;
