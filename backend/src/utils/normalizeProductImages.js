export function normalizeProductImages(images = []) {
  return images.map(img => ({
    publicId: img.publicId || img.public_id || "",
    variants: img.variants || {},
    formats: img.formats || {},
    metadata: img.metadata || {},
  }));
}
