export const PLACEHOLDER_IMAGE = "/images/dummyimage.png";

export function isPlaceholderImage(url?: string | null) {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  return (
    trimmed === PLACEHOLDER_IMAGE ||
    trimmed.endsWith("/dummyimage.png") ||
    trimmed.endsWith("/images/dummyimage.png")
  );
}

/** Keep a real CDN/http image when a caller tries to replace it with empty/dummy. */
export function nextStoredImage(
  incoming: string | null | undefined,
  existing?: string | null
) {
  if (incoming === undefined) return undefined;
  const next = incoming?.trim() || PLACEHOLDER_IMAGE;
  if (isPlaceholderImage(next) && existing && !isPlaceholderImage(existing)) {
    return existing;
  }
  return next;
}

export function sniffImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
  if (["heic", "heif", "mif1", "msf1"].includes(brand)) return "image/heic";
  return null;
}

export function contentTypeFromFileName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return null;
}
