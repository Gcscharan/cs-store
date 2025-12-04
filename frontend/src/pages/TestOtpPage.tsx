import { useState } from "react";
import { useOtpModal } from "../contexts/OtpModalContext";
import OtpLoginModal from "../components/OtpLoginModal";

const TestOtpPage = () => {
  const { showOtpModal, isOtpModalOpen } = useOtpModal();
  const [showDirectModal, setShowDirectModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Test OTP Modal</h1>
        <p className="mb-4">Test the OTP modal in different ways:</p>
        <div className="space-y-4">
          <button
            onClick={() => showOtpModal("/account/profile")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 block"
          >
            Show OTP Modal (via Context)
          </button>
          <button
            onClick={() => setShowDirectModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 block"
          >
            Show OTP Modal (Direct)
          </button>
          <p className="text-sm text-gray-600">
            Modal state: {isOtpModalOpen ? "Open" : "Closed"}
          </p>
        </div>
      </div>

      {/* Direct modal test */}
      <OtpLoginModal
        isOpen={showDirectModal}
        onClose={() => setShowDirectModal(false)}
        redirectTo="/account/profile"
      />
    </div>
  );
};

export default TestOtpPage;
