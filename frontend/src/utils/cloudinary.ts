/**
 * Cloudinary has been fully disabled.
 * This project now uses Base64 images stored in MongoDB.
 * Any attempt to call this function will throw an error,
 * so that Cloudinary is never accidentally used again.
 */
export const uploadToCloudinary = async () => {
  throw new Error(
    "Cloudinary is disabled. The project now uses Base64 image storage. \
Do not use uploadToCloudinary. Use fileToBase64 from base64.ts instead."
  );
};
