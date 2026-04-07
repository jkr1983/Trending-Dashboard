import React, { useState } from "react";
import { timeAgo, isValidThumbnail } from "../utils/formatters";
import "./shared.css";
import "./DevTo.css";

function ArticleCard({ article }) {
  const [imgError, setImgError] = useState(false);
  const hasCover = isValidThumbnail(article.coverImage) && !imgError;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="dt-article-card"
    >
      {hasCover && (
        <div className="dt-cover-wrap">
          <img
            src={article.coverImage}
            alt={article.title}
            className="dt-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      <div className="dt-content">
        <div className="dt-header">
          <span className="dt-rank">#{article.rank}</span>
          {article.tags.length > 0 && (
            <div className="dt-tags">
              {article.tags.map((tag) => (
                <span key={tag} className="dt-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <p className="dt-title">{article.title}</p>
        {article.description && (
          <p className="dt-description">{article.description}</p>
        )}
        <div className="dt-meta">
          {article.author.avatar && (
            <img
              src={article.author.avatar}
              alt={article.author.name}
              className="dt-avatar"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}
          <span className="dt-author">{article.author.name}</span>
          <span className="dt-dot">·</span>
          <span className="dt-reactions">❤️ {article.reactions}</span>
          <span className="dt-dot">·</span>
          <span className="dt-comments">💬 {article.comments}</span>
          {article.readingTime && (
            <>
              <span className="dt-dot">·</span>
              <span className="dt-read-time">{article.readingTime} min read</span>
            </>
          )}
          {article.publishedAt && (
            <>
              <span className="dt-dot">·</span>
              <span className="dt-time">{timeAgo(article.publishedAt)}</span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="dt-article-card dt-skeleton">
      <div className="dt-content">
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div className="skeleton" style={{ width: 28, height: 14, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 80, height: 14, borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ height: 16, width: "90%", marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: "70%", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="skeleton" style={{ width: 22, height: 22, borderRadius: "50%" }} />
          <div className="skeleton" style={{ width: 80, height: 11 }} />
          <div className="skeleton" style={{ width: 50, height: 11 }} />
        </div>
      </div>
    </div>
  );
}

export default function DevTo({ data, loading, error }) {
  return (
    <section className="dt-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">📝</span>
          <h2>Dev.to</h2>
          <span className="section-badge">Top Today</span>
        </div>
        <a
          href="https://dev.to"
          target="_blank"
          rel="noreferrer"
          className="section-link"
        >
          dev.to ↗
        </a>
      </div>

      {error && (
        <div className="section-error">
          <span>⚠</span> Failed to load Dev.to articles: {error}
        </div>
      )}

      <div className="dt-article-list">
        {loading
          ? Array.from({ length: 10 }, (_, i) => <SkeletonCard key={i} />)
          : (data || []).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
      </div>
    </section>
  );
}
