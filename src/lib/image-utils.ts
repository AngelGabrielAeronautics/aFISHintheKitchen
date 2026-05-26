// Web-renderable raster image formats. HEIC/HEIF are deliberately excluded:
// browsers report them as image/heic but cannot display them, so they must be blocked.
// SVG is excluded for security (can carry embedded scripts in user uploads).
const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const ACCEPTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
];

// Use on file inputs' `accept` attribute so the OS picker filters to compatible files.
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_EXTENSIONS.join(",");

/**
 * Returns an error message if the file is not a browser-compatible image,
 * or null if the file is acceptable.
 */
export function validateImageFile(file: File): string | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));

  const accepted =
    ACCEPTED_IMAGE_MIME_TYPES.includes(type) ||
    // Some browsers report an empty MIME type; fall back to the extension.
    (type === "" && ACCEPTED_IMAGE_EXTENSIONS.includes(ext));

  if (accepted) return null;

  if (
    type === "image/heic" ||
    type === "image/heif" ||
    ext === ".heic" ||
    ext === ".heif"
  ) {
    return "HEIC/HEIF photos (from iPhone) can't be shown in a browser. Convert to JPEG or PNG first, or set your iPhone camera to 'Most Compatible'.";
  }

  return "Please choose a JPEG, PNG, WebP, GIF, or AVIF image.";
}

// A photo in a recipe form: either already saved (a URL) or newly added (a File + preview).
export type RecipePhoto =
  | { id: string; kind: "existing"; url: string }
  | { id: string; kind: "new"; file: File; preview: string };

/** Reads a File into a data URL for previewing before upload. */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Validates a batch of dropped/selected files, keeping only compatible images
 * and capping to `remaining` slots. Returns the accepted files plus the first
 * error encountered (bad format or over the limit), if any.
 */
export function partitionImageFiles(
  files: File[],
  remaining: number
): { accepted: File[]; error: string | null } {
  const valid: File[] = [];
  let error: string | null = null;

  for (const file of files) {
    const fileError = validateImageFile(file);
    if (fileError) {
      if (!error) error = fileError;
    } else {
      valid.push(file);
    }
  }

  if (valid.length > remaining) {
    return {
      accepted: valid.slice(0, Math.max(0, remaining)),
      error:
        remaining <= 0
          ? "You've reached the photo limit."
          : `Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added.`,
    };
  }

  return { accepted: valid, error };
}
