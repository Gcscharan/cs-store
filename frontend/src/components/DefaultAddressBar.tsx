import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

interface Address {
  _id: string;
  id?: string;
  name?: string;
  customerName?: string;
  city: string;
  pincode: string;
  label: string;
  isDefault: boolean;
}

interface DefaultAddressBarProps {
  onOpenLocationModal: () => void;
}

const DefaultAddressBar: React.FC<DefaultAddressBarProps> = ({
  onOpenLocationModal,
}) => {
  const [_addresses, _setAddresses] = useState<Address[]>([]);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch("/api/user/addresses", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const addressesList = data.addresses || [];
          _setAddresses(addressesList);

          // Find default address
          const defaultAddr = addressesList.find(
            (addr: Address) => addr.isDefault
          );
          setDefaultAddress(defaultAddr || null);
        } else {
          // Fallback to localStorage
          const savedAddresses = JSON.parse(
            localStorage.getItem("saved_addresses") || "[]"
          );
          _setAddresses(savedAddresses);
          const defaultAddr = savedAddresses.find(
            (addr: Address) => addr.isDefault
          );
          setDefaultAddress(defaultAddr || null);
        }
      } catch (error) {
        console.error("Error fetching addresses:", error);
        // Fallback to localStorage
        const savedAddresses = JSON.parse(
          localStorage.getItem("saved_addresses") || "[]"
        );
        _setAddresses(savedAddresses);
        const defaultAddr = savedAddresses.find(
          (addr: Address) => addr.isDefault
        );
        setDefaultAddress(defaultAddr || null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddresses();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border-b border-neutral-200 py-2 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-2">
            <div className="animate-pulse bg-gray-200 h-4 w-48 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if there's no default address
  if (!defaultAddress) {
    return null;
  }

  return (
    <div className="bg-white border-b border-neutral-200 py-2 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={onOpenLocationModal}
            className="flex items-center gap-2 text-gray-700 hover:text-primary-600 transition-colors group"
          >
            <MapPin className="h-4 w-4 text-primary-600 group-hover:text-primary-700" />
            <span className="text-sm font-medium">
              Deliver to{" "}
              {defaultAddress.name || defaultAddress.customerName || "Unknown"}{" "}
              — {defaultAddress.city}, {defaultAddress.pincode}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DefaultAddressBar;
