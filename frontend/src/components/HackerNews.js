import React, { useMemo, useState } from "react";
import { formatScore, timeAgo } from "../utils/formatters";
import {
  TIME_FRAME_OPTIONS,
  COUNT_OPTIONS,
  DEFAULT_TIME_FRAME_DAYS,
  DEFAULT_COUNT,
  applyTimeAndCountFilter,
  timeFrameLabel,
} from "../utils/filterOptions";
import "./shared.css";
import "./HackerNews.css";

function StoryRow({ story, index }) {
  // Display rank reflects the filtered position, not the original fetch rank
  const displayRank = index + 1;
  return (
    <div className="hn-story">
      <span className="hn-rank">#{displayRank}</span>
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
  const [timeFrameDays, setTimeFrameDays] = useState(DEFAULT_TIME_FRAME_DAYS);
  const [count,         setCount]         = useState(DEFAULT_COUNT);

  // Client-side filter on `story.time` (ISO string populated by the backend
  // normaliser). HN's `time` field is the source of truth for "when was this
  // submitted." We slice the pre-fetched 100-story super-set down to whatever
  // the user picked.
  const stories = useMemo(
    () => applyTimeAndCountFilter(data, timeFrameDays, count, "time"),
    [data, timeFrameDays, count]
  );

  const badgeLabel = useMemo(
    () => `Top Stories · ${timeFrameLabel(timeFrameDays)}`,
    [timeFrameDays]
  );

  return (
    <section className="hn-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">🔶</span>
          <h2>Hacker News</h2>
          <span className="section-badge">{badgeLabel}</span>
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

      {/* Filter row — shared UX with every other source page. */}
      <div className="filter-row" role="group" aria-label="Hacker News filters">
        <label className="filter-group">
          <span className="filter-label">Time frame</span>
          <select
            className="filter-select"
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
        <label className="filter-group">
          <span className="filter-label">Show</span>
          <select
            className="filter-select"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={loading}
            aria-label="Number of stories"
          >
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} stories</option>
            ))}
          </select>
        </label>
      </div>

      <div className="hn-list">
        {loading
          ? Array.from({ length: Math.min(count, 10) }, (_, i) => <SkeletonRow key={i} />)
          : stories.length > 0
            ? stories.map((story, i) => (
                <StoryRow key={story.id} story={story} index={i} />
              ))
            : !error && (
                <p className="empty-state">No stories found for this time frame.</p>
              )}
      </div>
    </section>
  );
}
