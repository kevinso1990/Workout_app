/**
 * Downscale remote images for list thumbnails via images.weserv.nl (no API key).
 * Keeps full URL unchanged when resolution is not requested or URL is invalid.
 */
export function withListThumbnailResolution(
  url: string | null,
  resolution: number,
): string | null {
  if (!url || !resolution || resolution < 32) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${resolution}&h=${resolution}&fit=cover&output=jpg`;
}
