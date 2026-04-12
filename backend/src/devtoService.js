const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const DEVTO_BASE = "https://dev.to/api";
// Fetch a wide super-set so the frontend can filter client-side. Dev.to's
// `top=N` parameter means "top articles from the past N days", so we pull
// 30 days of window with up to 50 articles — enough to satisfy the widest
// dropdown pick (20 days × 50 count) without any per-change API calls.
const TOP_DAYS = 30;
const PER_PAGE = 50;

/**
 * Normalises a raw Dev.to article into a clean object.
 */
function normalizeArticle(item, rank) {
  if (!item || !item.id) return null;
  return {
    id: item.id,
    rank,
    title: item.title || "Untitled",
    url: item.url || `https://dev.to/${item.path}`,
    description: item.description
      ? item.description.slice(0, 140) + (item.description.length > 140 ? "…" : "")
      : "",
    coverImage: item.cover_image || item.social_image || null,
    tags: Array.isArray(item.tag_list) ? item.tag_list.slice(0, 4) : [],
    reactions: item.public_reactions_count || 0,
    comments: item.comments_count || 0,
    readingTime: item.reading_time_minutes || null,
    publishedAt: item.published_at || null,
    author: {
      name: item.user?.name || "Unknown",
      username: item.user?.username || "",
      avatar: item.user?.profile_image_90 || null,
    },
  };
}

/**
 * Fetches the top Dev.to articles over the widest window we support
 * (`TOP_DAYS = 30`, `per_page = PER_PAGE = 50`). The frontend filters this
 * super-set client-side based on the user's time-frame dropdown.
 * No API key required for public endpoints.
 */
async function fetchTopArticles() {
  const client = createHttpClient({ timeout: 12000, retries: 2 });

  const res = await client.get(`${DEVTO_BASE}/articles`, {
    params: {
      top: TOP_DAYS,      // widest window — 30 days of top articles
      per_page: PER_PAGE, // up to 50 articles per response
    },
    headers: {
      "Accept": "application/vnd.forem.api-v1+json",
      "User-Agent": "TrendPulse/3.4",
    },
  });

  const articles = (res.data || [])
    .map((item, i) => normalizeArticle(item, i + 1))
    .filter(Boolean);

  logger.info(`Dev.to: fetched ${articles.length} articles`);
  return articles;
}

module.exports = { fetchTopArticles, normalizeArticle };
