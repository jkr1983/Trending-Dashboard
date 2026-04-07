/**
 * Formats a large number into a human-readable string.
 * e.g. 1500000 → "1.5M", 12500 → "12.5K"
 */
export function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/**
 * Returns a human-readable time-ago string from an ISO timestamp.
 * e.g. "2h ago", "3d ago", "just now"
 */
export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/**
 * Truncates a string to maxLen characters and appends ellipsis if truncated.
 */
export function truncate(str, maxLen = 120) {
  if (!str || typeof str !== "string") return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

/**
 * e.g. 12500 → "12.5k"
 */
export function formatScore(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

/**
 * Returns true if a URL string is a valid http/https thumbnail URL.
 */
export function isValidThumbnail(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Formats seconds into a mm:ss countdown string.
 * e.g. 90 → "1m 30s"
 */
export function formatCountdown(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return "0m 00s";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
