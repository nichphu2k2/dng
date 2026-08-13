/**
 * Utility to get the correct URL for uploaded files
 */

export const getFileUrl = (filePath) => {
  if (!filePath) return null;
  
  // If it's already a full URL, return as is
  if (filePath.startsWith("http")) {
    return filePath;
  }
  
  // Determine the backend host for uploaded files.
  // If the configured API URL contains /api, uploads should still be served from the backend root.
  const rawApiBase = import.meta.env.VITE_API_URL;
  const apiBase = rawApiBase
    ? rawApiBase.replace(/\/api\/?$/, "")
    : `${window.location.protocol}//${window.location.hostname}:3000`;
  
  // Remove leading slash if present and normalize any old /app/uploads prefix.
  let normalizedPath = filePath.startsWith("/") ? filePath : "/" + filePath;
  normalizedPath = normalizedPath.replace(/^\/app\/uploads/, "/uploads");
  
  return `${apiBase}${normalizedPath}`;
};

export default getFileUrl;
