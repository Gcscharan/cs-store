import React, { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { motion } from "framer-motion";
import { Camera, Upload, X, Check, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DeliverySelfiePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!user || user.role !== "delivery") {
      navigate("/login");
      return;
    }
  }, [user, navigate]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access denied. Please use file upload instead.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const dataURL = canvas.toDataURL("image/jpeg", 0.8);
        setPreview(dataURL);
        stopCamera();
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadSelfie = async () => {
    if (!preview) {
      setError("Please capture or select a selfie first");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Convert data URL to blob
      const response = await fetch(preview);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append("selfie", blob, "selfie.jpg");

      const uploadResponse = await fetch("/api/delivery/upload-selfie", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || "Upload failed");
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/delivery");
      }, 2000);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const retakePhoto = () => {
    setPreview(null);
    setError(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Selfie Uploaded!
          </h2>
          <p className="text-gray-600 mb-4">
            Your selfie has been successfully uploaded. Redirecting to
            dashboard...
          </p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Selfie Verification
          </h1>
          <p className="text-gray-600">
            Please capture or upload a clear selfie for verification
          </p>
        </motion.div>

        {/* Camera Section */}
        {showCamera && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-lg p-4 mb-6"
          >
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-64 object-cover rounded-xl"
              />
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={stopCamera}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={capturePhoto}
              className="w-full mt-4 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              <Camera className="h-5 w-5 mr-2" />
              Capture Photo
            </button>
          </motion.div>
        )}

        {/* Preview Section */}
        {preview && !showCamera && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-lg p-4 mb-6"
          >
            <div className="relative">
              <img
                src={preview}
                alt="Selfie preview"
                className="w-full h-64 object-cover rounded-xl"
              />
            </div>
            <div className="flex space-x-3 mt-4">
              <button
                onClick={retakePhoto}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors font-semibold"
              >
                <X className="h-5 w-5 mr-2" />
                Retake
              </button>
              <button
                onClick={uploadSelfie}
                disabled={isUploading}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <Check className="h-5 w-5 mr-2" />
                )}
                {isUploading ? "Uploading..." : "Upload Selfie"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        {!preview && !showCamera && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <button
              onClick={startCamera}
              className="w-full flex items-center justify-center px-4 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg"
            >
              <Camera className="h-6 w-6 mr-3" />
              Open Camera
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center px-4 py-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors font-semibold text-lg"
            >
              <Upload className="h-6 w-6 mr-3" />
              Upload from Gallery
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </motion.div>
        )}

        {/* Error Messages */}
        {(error || cameraError) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"
          >
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
              <p className="text-red-800">{error || cameraError}</p>
            </div>
          </motion.div>
        )}

        {/* Instructions */}
        {!preview && !showCamera && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-6 mt-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Instructions:
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Ensure good lighting and clear visibility of your face
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Look directly at the camera with a neutral expression
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Make sure your entire face is visible in the frame
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                File size should be less than 5MB
              </li>
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DeliverySelfiePage;
