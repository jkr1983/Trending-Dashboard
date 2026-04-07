import React from "react";
import { formatNum } from "../utils/formatters";
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

function RepoCard({ repo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noreferrer"
      className="gh-repo-card"
    >
      <div className="gh-repo-header">
        <span className="gh-rank">#{repo.rank}</span>
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
  return (
    <section className="gh-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">🐙</span>
          <h2>GitHub Trending</h2>
          <span className="section-badge">Today</span>
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

      <div className="gh-repo-list">
        {loading
          ? Array.from({ length: 10 }, (_, i) => <SkeletonCard key={i} />)
          : (data || []).map((repo) => (
              <RepoCard key={repo.fullName} repo={repo} />
            ))}
      </div>
    </section>
  );
}
