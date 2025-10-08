import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
} from "../utils/cloudinary";
import toast from "react-hot-toast";

interface FileUploadProps {
  onUpload: (urls: string[]) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in MB
  folder?: string;
  className?: string;
}

const FileUpload = ({
  onUpload,
  multiple = false,
  accept = "image/*",
  maxFiles = 5,
  maxSize = 5,
  folder = "cps-store",
  className = "",
}: FileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // Validate file count
    if (fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file size
    const oversizedFiles = fileArray.filter(
      (file) => file.size > maxSize * 1024 * 1024
    );
    if (oversizedFiles.length > 0) {
      toast.error(`Files must be smaller than ${maxSize}MB`);
      return;
    }

    // Validate file type
    const invalidFiles = fileArray.filter(
      (file) => !file.type.startsWith("image/")
    );
    if (invalidFiles.length > 0) {
      toast.error("Only image files are allowed");
      return;
    }

    try {
      setIsUploading(true);

      const uploadOptions = {
        folder,
        quality: "auto",
        format: "auto",
      };

      const results = multiple
        ? await uploadMultipleToCloudinary(fileArray, uploadOptions)
        : [await uploadToCloudinary(fileArray[0], uploadOptions)];

      const urls = results.map((result) => result.secure_url);
      setUploadedFiles((prev) => [...prev, ...urls]);
      onUpload(urls);

      toast.success(`${urls.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? "border-primary-500 bg-primary-50"
            : "border-gray-300 hover:border-gray-400"
        } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
        />

        {isUploading ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📁</div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {dragActive ? "Drop files here" : "Drag & drop files here"}
              </p>
              <p className="text-sm text-gray-600">
                or{" "}
                <button
                  type="button"
                  onClick={openFileDialog}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  browse files
                </button>
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Max {maxFiles} files, {maxSize}MB each
            </p>
          </div>
        )}
      </div>

      {/* Uploaded Files Preview */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <h4 className="text-sm font-medium text-gray-900">
              Uploaded Files:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {uploadedFiles.map((url, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group"
                >
                  <img
                    src={url}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;
