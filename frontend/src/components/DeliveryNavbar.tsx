import React from "react";
import {
  MapPin,
  Headphones,
  AlertTriangle,
  ShoppingCart,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useGetProfileQuery } from "../store/api";

interface DeliveryNavbarProps {}

const DeliveryNavbar: React.FC<DeliveryNavbarProps> = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  // Fetch profile from MongoDB for name display
  const { data: profile } = useGetProfileQuery(undefined, {
    skip: !isAuthenticated,
  });

  return (
    <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white">
      {/* Status Bar - Top Line with CS Store Logo Position */}
      <div className="flex justify-between items-center px-4 py-2 text-xs">
        <div className="flex items-center space-x-3">
          {/* CS Store Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm leading-tight">
                CS
              </span>
              <span className="text-white font-bold text-xs leading-tight">
                STORE
              </span>
            </div>
          </button>

          {/* Delivery Boy Name - from MongoDB profile */}
          {(profile?.name || user?.email) && (
            <div className="flex items-center space-x-2 ml-4 bg-white/10 px-3 py-1.5 rounded-lg">
              <User className="h-4 w-4 text-white" />
              <span className="text-white font-medium text-sm">
                {profile?.name || user?.email}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Action Icons */}
          <button className="p-1 bg-white/10 hover:bg-white/20 rounded transition-colors">
            <MapPin className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/delivery/help-center")}
            className="p-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
            aria-label="Help Center"
          >
            <Headphones className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/delivery/emergency")}
            className="p-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryNavbar;
