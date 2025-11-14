import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Shield, Clock, HelpCircle } from "lucide-react";

const DeliveryEmergencyPage: React.FC = () => {
  const navigate = useNavigate();

  const handleEmergencyCall = (type: "helpline" | "police" | "ambulance") => {
    const numbers = {
      helpline: "9391795162",
      police: "100",
      ambulance: "108",
    };

    const labels = {
      helpline: "CS Store Helpline",
      police: "Police",
      ambulance: "Ambulance",
    };

    if (navigator.userAgent.includes("Mobile")) {
      window.location.href = `tel:${numbers[type]}`;
    } else {
      alert(`Calling ${labels[type]}: ${numbers[type]}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/delivery")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>
          <div className="flex items-center space-x-2">
            <HelpCircle className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900">
              Emergency Assistance
            </h1>
          </div>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-8 mb-6 max-w-2xl mx-auto"
        >
          <div className="text-center mb-8">
            <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-6">
              <HelpCircle className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-3xl font-semibold text-gray-900 mb-4">
              Emergency Assistance
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              If you're facing an emergency or need urgent help, please contact
              support immediately.
            </p>
          </div>

          {/* Primary Call Support Button */}
          <div className="text-center mb-8">
            <button
              onClick={() => handleEmergencyCall("helpline")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl flex items-center justify-center mx-auto space-x-3"
              aria-label="Call Support Now"
            >
              <Phone className="h-6 w-6" />
              <span className="text-lg">Call Support Now</span>
            </button>
            <p className="text-sm text-gray-500 mt-3">
              9391795162 • 24/7 Available
            </p>
          </div>

          {/* Emergency Options */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">
              Other Emergency Contacts
            </h3>

            <button
              onClick={() => handleEmergencyCall("police")}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-200"
            >
              <div className="flex items-center">
                <div className="p-2 bg-gray-600 rounded-lg mr-3">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-gray-900">
                    Police Emergency
                  </span>
                  <span className="text-sm text-gray-600 block">
                    Immediate Police Assistance
                  </span>
                </div>
              </div>
              <span className="text-lg font-semibold text-gray-700">100</span>
            </button>

            <button
              onClick={() => handleEmergencyCall("ambulance")}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-200"
            >
              <div className="flex items-center">
                <div className="p-2 bg-gray-600 rounded-lg mr-3">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-gray-900">
                    Medical Emergency
                  </span>
                  <span className="text-sm text-gray-600 block">
                    Ambulance Service
                  </span>
                </div>
              </div>
              <span className="text-lg font-semibold text-gray-700">108</span>
            </button>
          </div>
        </motion.div>

        {/* Additional Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl mx-auto"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Important Information
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p>
                <strong>Stay Calm:</strong> In case of emergency, try to remain
                calm and assess the situation carefully.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p>
                <strong>Location:</strong> Make sure you know your current
                location to provide accurate information to emergency services.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p>
                <strong>Safety First:</strong> Your safety is our top priority.
                Do not take unnecessary risks.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p>
                <strong>Report:</strong> Always report any incidents to CS Store
                support for proper documentation and follow-up.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DeliveryEmergencyPage;
