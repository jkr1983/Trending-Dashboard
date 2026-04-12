import React, { useMemo, useState } from "react";
import { formatNum, timeAgo, isValidThumbnail } from "../utils/formatters";
import "./shared.css";
import "./YouTube.css";

// ── User-adjustable filter options ────────────────────────────────────────────
// These drive the two dropdowns above the category tabs. Keep them in sync
// with the backend's MAX_AGE_MS (21 days) and MAX_RESULTS (50) — if either
// list exceeds those constants, the backend won't have data to fill the pick.
const TIME_FRAME_OPTIONS = [
  { days: 1,  label: "Past 1 day"   },
  { days: 2,  label: "Past 2 days"  },
  { days: 3,  label: "Past 3 days"  },
  { days: 5,  label: "Past 5 days"  },
  { days: 10, label: "Past 10 days" },
  { days: 20, label: "Past 20 days" },
];
const COUNT_OPTIONS = [5, 10, 15, 20, 25, 50];

const DEFAULT_TIME_FRAME_DAYS = 1;
const DEFAULT_COUNT           = 15;

function VideoCard({ video, index }) {
  const [imgError, setImgError] = useState(false);
  const hasThumbnail = isValidThumbnail(video.thumbnail) && !imgError;

  return (
    <a href={video.url} target="_blank" rel="noreferrer" className="video-card">
      <div className="video-rank">#{index + 1}</div>
      <div className="video-thumb-wrap">
        {hasThumbnail ? (
          <img src={video.thumbnail} alt={video.title} onError={() => setImgError(true)} />
        ) : (
          <div className="video-thumb-placeholder"><span>▶</span></div>
        )}
        <div className="video-play-overlay">▶</div>
      </div>
      <div className="video-info">
        <p className="video-title">{video.title}</p>
        <p className="video-channel">{video.channel}</p>
        <div className="video-stats">
          <span className="stat views">👁 {formatNum(video.views)}</span>
          <span className="stat likes">♥ {formatNum(video.likes)}</span>
          <span className="stat time">{timeAgo(video.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="video-card skeleton-card">
      <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 4 }} />
      <div className="skeleton video-thumb-wrap" />
      <div className="video-info">
        <div className="skeleton" style={{ height: 14, marginBottom: 8, width: "90%" }} />
        <div className="skeleton" style={{ height: 12, width: "50%", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ height: 10, width: 60 }} />
          <div className="skeleton" style={{ height: 10, width: 50 }} />
        </div>
      </div>
    </div>
  );
}

export default function YouTube({ data, loading, error }) {
  const categories = data ? Object.keys(data) : [];
  const [activeCategory, setActiveCategory] = useState("All");
  const [timeFrameDays,  setTimeFrameDays]  = useState(DEFAULT_TIME_FRAME_DAYS);
  const [count,          setCount]          = useState(DEFAULT_COUNT);

  const displayCat = data
    ? (activeCategory in data ? activeCategory : categories[0])
    : "All";
  const rawVideos = data?.[displayCat] || [];

  // Client-side filtering:
  //   1. Drop anything older than the selected time frame (by publishedAt)
  //   2. Slice the (sort-preserved) list to the selected count
  // The backend already sorts by viewCount desc and has dropped anything
  // unplayable or past the 21-day outer guardrail, so all we need here is
  // the age filter and the cap.
  const videos = useMemo(() => {
    if (!rawVideos.length) return rawVideos;
    const cutoffMs = Date.now() - timeFrameDays * 24 * 60 * 60 * 1000;
    return rawVideos
      .filter((v) => {
        if (!v.publishedAt) return false;
        const ts = Date.parse(v.publishedAt);
        return !Number.isNaN(ts) && ts >= cutoffMs;
      })
      .slice(0, count);
  }, [rawVideos, timeFrameDays, count]);

  const badgeLabel = useMemo(() => {
    const opt = TIME_FRAME_OPTIONS.find((o) => o.days === timeFrameDays);
    return `Trending · ${opt ? opt.label : `Past ${timeFrameDays} days`}`;
  }, [timeFrameDays]);

  return (
    <section className="yt-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">▶️</span>
          <h2>YouTube</h2>
          <span className="section-badge">{badgeLabel}</span>
        </div>
        <a
          href="https://www.youtube.com/feed/trending"
          target="_blank"
          rel="noreferrer"
          className="section-link"
        >
          youtube.com/trending ↗
        </a>
      </div>

      {error && (
        <div className="section-error">
          <span>⚠</span> {error}
        </div>
      )}

      {/* Filter row — lets the user pick the time window and how many
          videos to show. Both are client-side; the backend ships a wide
          super-set (21 days, up to 50/category) and this slices through it. */}
      <div className="yt-filters" role="group" aria-label="YouTube filters">
        <label className="yt-filter">
          <span className="yt-filter-label">Time frame</span>
          <select
            className="yt-select"
            value={timeFrameDays}
            onChange={(e) => setTimeFrameDays(Number(e.target.value))}
            disabled={loading}
            aria-label="Time frame"
          >
            {TIME_FRAME_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="yt-filter">
          <span className="yt-filter-label">Show</span>
          <select
            className="yt-select"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={loading}
            aria-label="Number of videos"
          >
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} videos</option>
            ))}
          </select>
        </label>
      </div>

      {/* Category tabs */}
      <div className="category-tabs">
        {(loading ? ["All", "Music", "Gaming", "Entertainment", "News & Politics",
                     "Science & Technology", "Sports", "Comedy", "How-to & Style",
                     "People & Blogs", "Pets & Animals"] : categories
        ).map((cat) => (
          <button
            key={cat}
            className={`cat-tab${displayCat === cat ? " active yt-active" : ""}`}
            onClick={() => setActiveCategory(cat)}
            disabled={loading}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="video-grid">
        {loading
          ? Array.from({ length: Math.min(count, 15) }, (_, i) => <SkeletonCard key={i} />)
          : videos.length > 0
            ? videos.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)
            : !error && (
                <p className="empty-state">No videos found for this category.</p>
              )}
      </div>
    </section>
  );
}
