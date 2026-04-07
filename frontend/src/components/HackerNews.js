import React from "react";
import { formatScore, timeAgo } from "../utils/formatters";
import "./shared.css";
import "./HackerNews.css";

function StoryRow({ story }) {
  return (
    <div className="hn-story">
      <span className="hn-rank">#{story.rank}</span>
      <div className="hn-body">
        <a
          href={story.url}
          target="_blank"
          rel="noreferrer"
          className="hn-title"
        >
          {story.title}
        </a>
        <div className="hn-meta">
          {story.domain && (
            <span className="hn-domain">{story.domain}</span>
          )}
          <span className="hn-score">▲ {formatScore(story.score)}</span>
          <span className="hn-by">by {story.by}</span>
          <a
            href={story.commentsUrl}
            target="_blank"
            rel="noreferrer"
            className="hn-comments"
          >
            💬 {story.descendants}
          </a>
          {story.time && (
            <span className="hn-time">{timeAgo(story.time)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="hn-story skeleton-row">
      <div className="skeleton" style={{ width: 28, height: 16, borderRadius: 4, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 14, marginBottom: 8, width: "85%" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ height: 11, width: 80 }} />
          <div className="skeleton" style={{ height: 11, width: 60 }} />
          <div className="skeleton" style={{ height: 11, width: 50 }} />
        </div>
      </div>
    </div>
  );
}

export default function HackerNews({ data, loading, error }) {
  return (
    <section className="hn-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">🔶</span>
          <h2>Hacker News</h2>
          <span className="section-badge">Top Stories</span>
        </div>
        <a
          href="https://news.ycombinator.com"
          target="_blank"
          rel="noreferrer"
          className="section-link"
        >
          news.ycombinator.com ↗
        </a>
      </div>

      {error && (
        <div className="section-error">
          <span>⚠</span> Failed to load Hacker News stories: {error}
        </div>
      )}

      <div className="hn-list">
        {loading
          ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
          : (data || []).map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
      </div>
    </section>
  );
}
