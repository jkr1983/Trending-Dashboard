const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const DEVTO_BASE = "https://dev.to/api";
const TOP_N = 15;

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
 * Fetches top Dev.to articles from the past day.
 * No API key required for public endpoints.
 */
async function fetchTopArticles() {
  const client = createHttpClient({ timeout: 12000, retries: 2 });

  const res = await client.get(`${DEVTO_BASE}/articles`, {
    params: {
      top: 1,           // top articles from past N days (1 = past day)
      per_page: TOP_N,
    },
    headers: {
      "Accept": "application/vnd.forem.api-v1+json",
      "User-Agent": "TrendPulse/2.0",
    },
  });

  const articles = (res.data || [])
    .map((item, i) => normalizeArticle(item, i + 1))
    .filter(Boolean);

  logger.info(`Dev.to: fetched ${articles.length} articles`);
  return articles;
}

module.exports = { fetchTopArticles, normalizeArticle };
