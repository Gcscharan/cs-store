import React, { ReactNode, useEffect } from "react";
import { ToastProvider } from "./AccessibleToast";

interface LoginLayoutProps {
  children: ReactNode;
  title?: string;
}

const LoginLayout: React.FC<LoginLayoutProps> = ({
  children,
  title = "CS Store",
}) => {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Main Content */}
        <main className="flex-1" role="main">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
};

export default LoginLayout;
