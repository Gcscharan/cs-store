import React, { useRef, useState } from "react";

// ─── Product image standards (mirrors backend/src/utils/productImageValidation.ts) ──
const IMAGE_STANDARDS = {
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/webp"],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".webp"],
  MAX_FILE_SIZE_BYTES: 500 * 1024, // 500 KB
  MIN_DIMENSION: 600,
  MAX_DIMENSION: 1080,
  MAX_INPUT_DIMENSION: 4000, // hard pixel guard
  ASPECT_RATIO_TOLERANCE: 1,
} as const;

interface FileUploadProps {
  images: Array<{ full: string; thumb: string }>;
  onChange: (updatedImages: Array<{ full: string; thumb: string }>) => void;
}

/** Read image dimensions from a File object */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

/** Client-side validation — returns list of error strings (empty = valid) */
async function validateImageFile(file: File): Promise<string[]> {
  const errors: string[] = [];
  const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MIN_DIMENSION, MAX_INPUT_DIMENSION, ASPECT_RATIO_TOLERANCE } =
    IMAGE_STANDARDS;

  // Format
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
  const extOk = ["jpg", "jpeg", "webp"].includes(ext);
  if (!mimeOk && !extOk) {
    errors.push(`"${file.name}": only JPEG and WebP images are accepted.`);
    return errors; // Can't read dimensions of unsupported format
  }

  // File size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const kb = Math.round(file.size / 1024);
    errors.push(`"${file.name}": ${kb} KB exceeds the 500 KB limit.`);
  }

  // Dimensions
  try {
    const { width, height } = await getImageDimensions(file);

    // Hard pixel guard — reject before server even tries to process
    if (width > MAX_INPUT_DIMENSION || height > MAX_INPUT_DIMENSION) {
      errors.push(
        `"${file.name}": dimensions ${width}×${height} are too large. Max input is ${MAX_INPUT_DIMENSION}×${MAX_INPUT_DIMENSION} px.`,
      );
      return errors;
    }

    // Aspect ratio
    if (Math.abs(width - height) > ASPECT_RATIO_TOLERANCE) {
      errors.push(
        `"${file.name}": must be square (1:1). Got ${width}×${height} — please crop before uploading.`,
      );
    }

    // Minimum resolution
    const side = Math.min(width, height);
    if (side < MIN_DIMENSION) {
      errors.push(
        `"${file.name}": too small (${width}×${height}). Minimum is ${MIN_DIMENSION}×${MIN_DIMENSION} px.`,
      );
    }
  } catch {
    errors.push(`"${file.name}": could not read image dimensions.`);
  }

  return errors;
}

export default function FileUpload({ images, onChange }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadToBackend = async (file: File): Promise<{ full: string; thumb: string }> => {
    const base64 = await convertToBase64(file);
    const response = await fetch("/api/uploads/cloudinary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: `data:${file.type};base64,${base64}` }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg =
        body?.errors?.join(" ") ||
        body?.error ||
        `Upload failed: ${response.statusText}`;
      throw new Error(msg);
    }

    return await response.json();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setValidationErrors([]);

    // ── Client-side validation ────────────────────────────────────────────
    const allErrors: string[] = [];
    for (const file of Array.from(files)) {
      const errs = await validateImageFile(file);
      allErrors.push(...errs);
    }

    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      return;
    }

    setIsUploading(true);

    try {
      const results = await Promise.all(
        Array.from(files).map((file) => uploadToBackend(file)),
      );
      onChange([...images, ...results]);
    } catch (error: any) {
      setValidationErrors([error.message || "Failed to upload images. Please try again."]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(event.target.files);
    if (event.target) event.target.value = "";
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    await handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/webp,.jpg,.jpeg,.webp"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          disabled={isUploading}
        />

        <div className="pointer-events-none">
          {isUploading ? (
            <div className="space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
              <p className="text-gray-600">Uploading images…</p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-gray-600">
                Drop images here or{" "}
                <button
                  type="button"
                  className="text-blue-500 hover:text-blue-600 font-medium"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500">
                JPEG or WebP · Square (1:1) · 600–1080 px · Max 500 KB · Output: WebP
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700 mb-1">
            Image requirements not met:
          </p>
          <ul className="list-disc list-inside space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-sm text-red-600">
                {err}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-500">
            Requirements: JPEG or WebP · Square (1:1) · Min 600×600 px · Max 500 KB
          </p>
        </div>
      )}

      {/* Image Preview Grid — always square containers */}
      {images.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Uploaded Images ({images.length}/5)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                {/* Square container — enforces 1:1 display */}
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={image.thumb}
                    alt={`Product image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Index badge */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
