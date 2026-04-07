import React, { useState } from "react";
import { formatNum, timeAgo, isValidThumbnail } from "../utils/formatters";
import "./shared.css";
import "./YouTube.css";

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

  const displayCat = data
    ? (activeCategory in data ? activeCategory : categories[0])
    : "All";
  const videos = data?.[displayCat] || [];

  return (
    <section className="yt-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">▶️</span>
          <h2>YouTube</h2>
          <span className="section-badge">Trending · Past 24h</span>
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
          ? Array.from({ length: 15 }, (_, i) => <SkeletonCard key={i} />)
          : videos.length > 0
            ? videos.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)
            : !error && (
                <p className="empty-state">No videos found for this category.</p>
              )}
      </div>
    </section>
  );
}
