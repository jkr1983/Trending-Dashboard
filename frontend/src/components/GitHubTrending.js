import React, { useMemo, useState } from "react";
import { formatNum } from "../utils/formatters";
import {
  TIME_FRAME_OPTIONS,
  COUNT_OPTIONS,
  DEFAULT_TIME_FRAME_DAYS,
  DEFAULT_COUNT,
  timeFrameLabel,
} from "../utils/filterOptions";
import "./shared.css";
import "./GitHubTrending.css";

const LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python:     "#3572A5",
  Rust:       "#dea584",
  Go:         "#00ADD8",
  Java:       "#b07219",
  "C++":      "#f34b7d",
  C:          "#555555",
  Ruby:       "#701516",
  Swift:      "#F05138",
  Kotlin:     "#A97BFF",
  Shell:      "#89e051",
  HTML:       "#e34c26",
  CSS:        "#563d7c",
  Vue:        "#41b883",
  Dockerfile: "#384d54",
  Nix:        "#7e7eff",
  Zig:        "#ec915c",
};

function getLangColor(lang) {
  return LANG_COLORS[lang] || "#8b949e";
}

/**
 * Maps the time-frame dropdown (1/2/3/5/10/20 days) to one of the three
 * buckets the backend pre-fetches (daily/weekly/monthly). GitHub Trending's
 * scrape has no per-repo publish timestamps, so we can't run a client-side
 * date filter like we do for HN or Dev.to — we have to pick the closest
 * bucket instead.
 *
 *    1 day          → daily
 *    2 or 3 days    → weekly
 *    5 / 10 / 20 d  → monthly
 *
 * This means "Past 10 days" and "Past 20 days" show the same monthly bucket,
 * which is lossy but honest — it's the widest window GitHub itself offers.
 */
function daysToBucket(days) {
  if (days <= 1) return "daily";
  if (days <= 3) return "weekly";
  return "monthly";
}

function RepoCard({ repo, rank }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noreferrer"
      className="gh-repo-card"
    >
      <div className="gh-repo-header">
        <span className="gh-rank">#{rank}</span>
        <span className="gh-repo-name">
          <span className="gh-owner">{repo.owner}</span>
          <span className="gh-slash">/</span>
          <span className="gh-name">{repo.name}</span>
        </span>
      </div>

      {repo.description && (
        <p className="gh-description">{repo.description}</p>
      )}

      <div className="gh-stats">
        {repo.language && (
          <span className="gh-lang">
            <span
              className="gh-lang-dot"
              style={{ background: getLangColor(repo.language) }}
            />
            {repo.language}
          </span>
        )}
        <span className="gh-stat">
          ⭐ {formatNum(repo.stars)}
        </span>
        <span className="gh-stat">
          🍴 {formatNum(repo.forks)}
        </span>
        {repo.starsToday > 0 && (
          <span className="gh-stars-today">
            +{formatNum(repo.starsToday)} today
          </span>
        )}
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="gh-repo-card gh-skeleton">
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <div className="skeleton" style={{ width: 28, height: 14, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ height: 12, width: "80%", marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <div className="skeleton" style={{ width: 70, height: 11, borderRadius: 3 }} />
        <div className="skeleton" style={{ width: 50, height: 11, borderRadius: 3 }} />
        <div className="skeleton" style={{ width: 50, height: 11, borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function GitHubTrending({ data, loading, error }) {
  const [timeFrameDays, setTimeFrameDays] = useState(DEFAULT_TIME_FRAME_DAYS);
  const [count,         setCount]         = useState(DEFAULT_COUNT);

  // `data` is now `{ daily: [], weekly: [], monthly: [] }` — the backend
  // pre-fetches all three buckets in parallel. Pick one based on the user's
  // time-frame dropdown, then slice to their count.
  const repos = useMemo(() => {
    if (!data) return [];
    const bucket = daysToBucket(timeFrameDays);
    const list = Array.isArray(data[bucket]) ? data[bucket] : [];
    return list.slice(0, count);
  }, [data, timeFrameDays, count]);

  const badgeLabel = useMemo(() => {
    const bucket = daysToBucket(timeFrameDays);
    // Human-readable bucket name in the badge so the user sees which GitHub
    // range they're actually looking at (daily / weekly / monthly) rather
    // than a 1:1 echo of their dropdown choice.
    const bucketLabel = bucket.charAt(0).toUpperCase() + bucket.slice(1);
    return `Trending · ${bucketLabel} · ${timeFrameLabel(timeFrameDays)}`;
  }, [timeFrameDays]);

  return (
    <section className="gh-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">🐙</span>
          <h2>GitHub Trending</h2>
          <span className="section-badge">{badgeLabel}</span>
        </div>
        <a
          href="https://github.com/trending"
          target="_blank"
          rel="noreferrer"
          className="section-link"
        >
          github.com/trending ↗
        </a>
      </div>

      {error && (
        <div className="section-error">
          <span>⚠</span> Failed to load GitHub Trending: {error}
        </div>
      )}

      {/* Filter row — time frame maps to GitHub's daily/weekly/monthly buckets.
          "Past 10 days" and "Past 20 days" both map to monthly — see daysToBucket. */}
      <div className="filter-row" role="group" aria-label="GitHub Trending filters">
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
            aria-label="Number of repos"
          >
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} repos</option>
            ))}
          </select>
        </label>
      </div>

      <div className="gh-repo-list">
        {loading
          ? Array.from({ length: Math.min(count, 10) }, (_, i) => <SkeletonCard key={i} />)
          : repos.length > 0
            ? repos.map((repo, i) => (
                <RepoCard key={repo.fullName} repo={repo} rank={i + 1} />
              ))
            : !error && (
                <p className="empty-state">No repos found for this time frame.</p>
              )}
      </div>
    </section>
  );
}
