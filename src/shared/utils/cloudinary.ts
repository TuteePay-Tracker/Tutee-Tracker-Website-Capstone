// Cloudinary configuration
// Uses unsigned upload preset for browser-safe client-side uploads
// (API secret is never exposed in frontend code)

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET; // unsigned preset to create in Cloudinary dashboard

export const CLOUDINARY_CONFIG = {
  cloudName: CLOUDINARY_CLOUD_NAME,
  uploadPreset: CLOUDINARY_UPLOAD_PRESET,
  apiKey: import.meta.env.VITE_CLOUDINARY_API_KEY,
};

/**
 * Upload an image file to Cloudinary using the unsigned upload API.
 * Returns the secure URL of the uploaded image.
 */
export const uploadToCloudinary = async (
  file: File,
  folder: string = 'tuteepay'
): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('api_key', CLOUDINARY_CONFIG.apiKey);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  return data.secure_url as string;
};

/**
 * Get a resized/optimized Cloudinary URL from an existing Cloudinary URL.
 * Uses Cloudinary's URL transformation API.
 */
export const getOptimizedUrl = (
  url: string,
  width: number = 200,
  height: number = 200
): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  // Insert transformation parameters before the version/path segment
  return url.replace(
    '/upload/',
    `/upload/c_fill,w_${width},h_${height},f_auto,q_auto/`
  );
};
