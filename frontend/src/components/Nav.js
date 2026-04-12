import React from "react";
import "./Nav.css";

// Pages are declared here and consumed by both Nav (to render pills) and
// App.js (to render the active section). Keep IDs URL-safe because they
// end up in window.location.hash.
export const PAGES = [
  { id: "youtube",    icon: "▶️", label: "YouTube"         },
  { id: "hackernews", icon: "🔶", label: "Hacker News"     },
  { id: "github",     icon: "🐙", label: "GitHub Trending" },
  { id: "devto",      icon: "📝", label: "Dev.to"          },
];

/**
 * Navigation bar rendered directly beneath the main Header. Each page is a
 * clickable "pill" styled to echo the section-title + section-badge look
 * from the individual source headers (emoji icon + name), so the user sees
 * the same visual vocabulary whether they're reading a pill or a page
 * header.
 *
 * Presentational — App.js owns the active-page state and the hash sync.
 */
export default function Nav({ activePage, onSelect }) {
  return (
    <nav className="dashboard-nav" aria-label="Primary">
      <ul className="nav-list" role="tablist">
        {PAGES.map((page) => {
          const isActive = page.id === activePage;
          return (
            <li key={page.id} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`page-${page.id}`}
                className={`nav-pill${isActive ? " nav-pill-active" : ""}`}
                onClick={() => onSelect(page.id)}
              >
                <span className="nav-pill-icon" aria-hidden="true">{page.icon}</span>
                <span className="nav-pill-label">{page.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
