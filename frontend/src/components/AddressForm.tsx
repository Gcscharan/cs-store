import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCheckPincodeQuery } from "../store/api";
import toast from "react-hot-toast";

interface AddressFormProps {
  onClose: () => void;
  onSave: (address: any) => void;
}

const AddressForm = ({ onClose, onSave }: AddressFormProps) => {
  const [formData, setFormData] = useState({
    label: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    lat: 0,
    lng: 0,
    isDefault: false,
  });

  const [pincode, setPincode] = useState("");
  const { data: pincodeData, isLoading: isCheckingPincode } =
    useCheckPincodeQuery(pincode, { skip: !pincode || pincode.length !== 6 });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPincode(value);
    setFormData((prev) => ({
      ...prev,
      pincode: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pincodeData?.serviceable) {
      toast.error("Unable to deliver to this location.");
      return;
    }

    if (!formData.label || !formData.addressLine || !formData.city) {
      toast.error("Please fill in all required fields.");
      return;
    }

    onSave({
      ...formData,
      state: pincodeData.state,
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Add Address
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Label */}
              <div>
                <label className="label">Label *</label>
                <input
                  type="text"
                  name="label"
                  value={formData.label}
                  onChange={handleInputChange}
                  placeholder="Home, Office, etc."
                  className="input"
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="label">Address Line *</label>
                <textarea
                  name="addressLine"
                  value={formData.addressLine}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressLine: e.target.value,
                    }))
                  }
                  placeholder="Street address, building, etc."
                  className="input min-h-[80px] resize-none"
                  required
                />
              </div>

              {/* Pincode */}
              <div>
                <label className="label">Pincode *</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={handlePincodeChange}
                  placeholder="6-digit pincode"
                  className="input"
                  maxLength={6}
                  required
                />
                {isCheckingPincode && (
                  <div className="text-sm text-gray-600 mt-1">
                    Checking pincode...
                  </div>
                )}
                {pincodeData && !pincodeData.serviceable && (
                  <div className="text-sm text-error-600 mt-1">
                    Unable to deliver to this location.
                  </div>
                )}
                {pincodeData && pincodeData.serviceable && (
                  <div className="text-sm text-success-600 mt-1">
                    ✓ Delivery available to {pincodeData.state}
                  </div>
                )}
              </div>

              {/* City */}
              <div>
                <label className="label">City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="City name"
                  className="input"
                  required
                />
              </div>

              {/* State (auto-filled from pincode) */}
              {pincodeData?.state && (
                <div>
                  <label className="label">State</label>
                  <input
                    type="text"
                    value={pincodeData.state}
                    className="input bg-gray-100"
                    readOnly
                  />
                </div>
              )}

              {/* Default Address */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <label className="text-sm text-gray-700">
                  Set as default address
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pincodeData?.serviceable}
                  className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AddressForm;
