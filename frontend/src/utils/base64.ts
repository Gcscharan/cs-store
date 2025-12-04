import imageCompression from "browser-image-compression";

export async function fileToBase64(file: File): Promise<string> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.4,         // compress to ~400 KB
      maxWidthOrHeight: 1200, // resize large images
      useWebWorker: true,
    });

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
  } catch (err) {
    console.error("Compression failed:", err);
    throw err;
  }
}

export async function fileToThumbnailBase64(file: File): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.08,        // target ~80 KB max
    maxWidthOrHeight: 220,  // small thumbnail for cards
    useWebWorker: true,
  });

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}

export async function urlToBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();

  return await fileToBase64(blob as File);
}
