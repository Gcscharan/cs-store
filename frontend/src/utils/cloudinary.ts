interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

interface CloudinaryUploadOptions {
  folder?: string;
  transformation?: string;
  quality?: string;
  format?: string;
}

export const uploadToCloudinary = async (
  file: File,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "upload_preset",
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ""
  );

  if (options.folder) {
    formData.append("folder", options.folder);
  }

  if (options.transformation) {
    formData.append("transformation", options.transformation);
  }

  if (options.quality) {
    formData.append("quality", options.quality);
  }

  if (options.format) {
    formData.append("format", options.format);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to upload image to Cloudinary");
  }

  return response.json();
};

export const uploadMultipleToCloudinary = async (
  files: File[],
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult[]> => {
  const uploadPromises = files.map((file) => uploadToCloudinary(file, options));
  return Promise.all(uploadPromises);
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  const response = await fetch("/api/cloudinary/delete", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    },
    body: JSON.stringify({ publicId }),
  });

  if (!response.ok) {
    throw new Error("Failed to delete image from Cloudinary");
  }
};

export const getCloudinaryUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
    format?: string;
  } = {}
): string => {
  const baseUrl = `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;

  let transformation = "";
  if (
    options.width ||
    options.height ||
    options.crop ||
    options.quality ||
    options.format
  ) {
    const params = [];
    if (options.width) params.push(`w_${options.width}`);
    if (options.height) params.push(`h_${options.height}`);
    if (options.crop) params.push(`c_${options.crop}`);
    if (options.quality) params.push(`q_${options.quality}`);
    if (options.format) params.push(`f_${options.format}`);

    transformation = `/${params.join(",")}`;
  }

  return `${baseUrl}${transformation}/${publicId}`;
};
