export function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

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

export function truncate(str, maxLen = 120) {
  if (!str || typeof str !== "string") return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

export function formatScore(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export function isValidThumbnail(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

export function formatCountdown(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return "0m 00s";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
