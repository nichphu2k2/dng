export default function downloadFile(blob, fileName) {
  const safeFileName = String(fileName || "export").replace(/^"|"$/g, "").trim() || "export";
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
