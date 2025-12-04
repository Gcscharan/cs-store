import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import OtpLoginModal from "../components/OtpLoginModal";

interface OtpModalContextType {
  showOtpModal: (redirectTo?: string) => void;
  hideOtpModal: () => void;
  isOtpModalOpen: boolean;
}

const OtpModalContext = createContext<OtpModalContextType | undefined>(
  undefined
);

export const useOtpModal = () => {
  const context = useContext(OtpModalContext);
  if (!context) {
    throw new Error("useOtpModal must be used within an OtpModalProvider");
  }
  return context;
};

interface OtpModalProviderProps {
  children: ReactNode;
}

export const OtpModalProvider: React.FC<OtpModalProviderProps> = ({
  children,
}) => {
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/account/profile");
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const showOtpModal = (redirectPath?: string) => {
    // Don't show modal if user is already authenticated
    if (isAuthenticated) {
      console.log("OtpModalContext: User is already authenticated, skipping modal");
      return;
    }
    
    console.log(
      "OtpModalContext: showOtpModal called with redirectPath:",
      redirectPath
    );
    setRedirectTo(redirectPath || "/account/profile");
    requestAnimationFrame(() => setIsOtpModalOpen(true));
    console.log("OtpModalContext: Modal should now be open");
  };

  const hideOtpModal = () => {
    setIsOtpModalOpen(false);
  };

  // Auto-close modal if user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && isOtpModalOpen) {
      console.log("OtpModalContext: User authenticated, closing modal");
      hideOtpModal();
    }
  }, [isAuthenticated, isOtpModalOpen]);

  // Only render modal if user is not authenticated
  const shouldShowModal = isOtpModalOpen && !isAuthenticated;

  return (
    <OtpModalContext.Provider
      value={{
        showOtpModal,
        hideOtpModal,
        isOtpModalOpen: shouldShowModal,
      }}
    >
      {children}
      {isOtpModalOpen && (
        <React.Suspense fallback={<></>}>
          <OtpLoginModal
            isOpen={!isAuthenticated}
            onClose={hideOtpModal}
            redirectTo={redirectTo}
          />
        </React.Suspense>
      )}
    </OtpModalContext.Provider>
  );
};
