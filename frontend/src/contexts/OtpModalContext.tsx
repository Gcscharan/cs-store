import React, { createContext, useContext, useState, ReactNode } from "react";
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

  const showOtpModal = (redirectPath?: string) => {
    console.log(
      "OtpModalContext: showOtpModal called with redirectPath:",
      redirectPath
    );
    setRedirectTo(redirectPath || "/account/profile");
    setIsOtpModalOpen(true);
    console.log("OtpModalContext: Modal should now be open");
  };

  const hideOtpModal = () => {
    setIsOtpModalOpen(false);
  };

  return (
    <OtpModalContext.Provider
      value={{
        showOtpModal,
        hideOtpModal,
        isOtpModalOpen,
      }}
    >
      {children}
      <OtpLoginModal
        isOpen={isOtpModalOpen}
        onClose={hideOtpModal}
        redirectTo={redirectTo}
      />
    </OtpModalContext.Provider>
  );
};
