// Extracts the 11-character video ID from the common YouTube URL shapes:
// watch?v=, youtu.be/, embed/, and shorts/.
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// hqdefault always exists for a valid video (unlike maxresdefault, which can 404).
export function getYouTubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
