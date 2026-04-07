import React, { useState } from "react";
import { formatNum, timeAgo, isValidThumbnail } from "../utils/formatters";
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
    <section className="platform-section yt-section">
      <div className="platform-header">
        <div className="platform-badge yt-badge">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/>
          </svg>
          YouTube
        </div>
        <span className="platform-subtitle">Trending Videos</span>
      </div>

      {error && (
        <div className="error-box" role="alert">
          <span>⚠</span> {error}
        </div>
      )}

      <div className="category-tabs" role="tablist">
        {loading
          ? Array(6).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ width: 80, height: 32, borderRadius: 20 }} />
            ))
          : categories.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={displayCat === cat}
                className={`cat-tab ${displayCat === cat ? "active yt-active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
      </div>

      <div className="video-grid">
        {loading
          ? Array(10).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : videos.length > 0
            ? videos.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)
            : !error && (
                <p className="empty-state">No videos found for this category.</p>
              )}
      </div>
    </section>
  );
}
