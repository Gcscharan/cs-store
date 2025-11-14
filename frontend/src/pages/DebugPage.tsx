import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useOtpModal } from "../contexts/OtpModalContext";

const DebugPage = () => {
  const auth = useSelector((state: RootState) => state.auth);
  const { isOtpModalOpen, showOtpModal } = useOtpModal();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  useEffect(() => {
    addLog("DebugPage mounted");
    addLog(`Auth state: isAuthenticated=${auth.isAuthenticated}`);
    addLog(`User: ${auth.user ? JSON.stringify(auth.user) : "null"}`);
    addLog(`OTP Modal Open: ${isOtpModalOpen}`);
  }, [auth.isAuthenticated, auth.user, isOtpModalOpen]);

  const testOtpModal = () => {
    addLog("Testing OTP modal...");
    showOtpModal("/account/profile");
  };

  const clearAuth = () => {
    addLog("Clearing auth...");
    localStorage.removeItem("auth");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Debug Page</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Auth State */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Authentication State</h2>
            <div className="space-y-2">
              <p>
                <strong>isAuthenticated:</strong>{" "}
                {auth.isAuthenticated ? "true" : "false"}
              </p>
              <p>
                <strong>User:</strong>{" "}
                {auth.user ? JSON.stringify(auth.user, null, 2) : "null"}
              </p>
              <p>
                <strong>Tokens:</strong> {auth.tokens ? "present" : "null"}
              </p>
              <p>
                <strong>OTP Modal Open:</strong>{" "}
                {isOtpModalOpen ? "true" : "false"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={testOtpModal}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Test OTP Modal
              </button>
              <button
                onClick={clearAuth}
                className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Clear Auth & Reload
              </button>
              <button
                onClick={() => (window.location.href = "/account/profile")}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Go to Account Profile
              </button>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-gray-100 p-4 rounded max-h-64 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-sm font-mono text-gray-700">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPage;
