 
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useOtpModal } from "../contexts/OtpModalContext";

const DebugAuth = () => {
  const auth = useSelector((state: RootState) => state.auth);
  const { isOtpModalOpen, showOtpModal } = useOtpModal();

  const clearAuth = () => {
    localStorage.removeItem("auth");
    window.location.reload();
  };

  return (
    <div className="fixed top-4 right-4 bg-black text-white p-4 rounded z-50">
      <h3 className="font-bold">Debug Auth State:</h3>
      <p>isAuthenticated: {auth.isAuthenticated ? "true" : "false"}</p>
      <p>user: {auth.user ? JSON.stringify(auth.user) : "null"}</p>
      <p>tokens: {auth.tokens ? "present" : "null"}</p>
      <p>OTP Modal Open: {isOtpModalOpen ? "true" : "false"}</p>
      <button
        onClick={clearAuth}
        className="bg-red-600 text-white px-2 py-1 rounded text-xs mt-2"
      >
        Clear Auth
      </button>
      <button
        onClick={() => showOtpModal("/account/profile")}
        className="bg-blue-600 text-white px-2 py-1 rounded text-xs mt-2 ml-2"
      >
        Test OTP Modal
      </button>
    </div>
  );
};

export default DebugAuth;
