import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import SignupForm from "../components/SignupForm";

const SignupPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  
  // Redirect authenticated users away from signup page
  useEffect(() => {
    if (isAuthenticated) {
      // Check admin first
      if (user?.isAdmin || user?.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }
      // Redirect to dashboard for regular users
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);
  
  // Extract passed credentials from URL parameters (since modal is outside Router context)
  const urlParams = new URLSearchParams(location.search);
  const prefilledCredential = urlParams.get('prefill') || urlParams.get('identifier');
  const fromLogin = urlParams.get('fromLogin') === 'true';
  
  const passedCredentials = prefilledCredential ? {
    emailOrPhone: decodeURIComponent(prefilledCredential),
    fromLogin: fromLogin
  } : null;

  // Don't render signup form if user is authenticated (redirect will happen)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900">
          CS Store
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <SignupForm prefilledCredentials={passedCredentials} />
      </div>
    </div>
  );
};

export default SignupPage;
