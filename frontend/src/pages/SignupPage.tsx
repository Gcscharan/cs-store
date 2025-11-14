import React from "react";
import { useLocation } from "react-router-dom";
import SignupForm from "../components/SignupForm";

const SignupPage: React.FC = () => {
  const location = useLocation();
  
  // Extract passed credentials from URL parameters (since modal is outside Router context)
  const urlParams = new URLSearchParams(location.search);
  const prefilledCredential = urlParams.get('prefill');
  const fromLogin = urlParams.get('fromLogin') === 'true';
  
  const passedCredentials = prefilledCredential ? {
    emailOrPhone: decodeURIComponent(prefilledCredential),
    fromLogin: fromLogin
  } : null;

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
