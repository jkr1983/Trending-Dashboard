import React, { useState, useCallback, useEffect } from "react";
import Header from "./components/Header";
import Nav, { PAGES } from "./components/Nav";
import YouTube from "./components/YouTube";
import HackerNews from "./components/HackerNews";
import GitHubTrending from "./components/GitHubTrending";
import DevTo from "./components/DevTo";
import ErrorBoundary from "./components/ErrorBoundary";
import { useTrending } from "./hooks/useTrending";
import "./App.css";

const PAGE_IDS = PAGES.map((p) => p.id);
const DEFAULT_PAGE = "youtube";

// Read the current hash and map it to a page id. Defaults to youtube if the
// hash is missing or points to something unknown. Used on initial mount and
// whenever the hash changes (back/forward button, manual edit).
function hashToPage(hash) {
  const id = (hash || "").replace(/^#\/?/, "").toLowerCase();
  return PAGE_IDS.includes(id) ? id : DEFAULT_PAGE;
}

export default function App() {
  const [refreshing, setRefreshing] = useState(false);
  const [activePage, setActivePage] = useState(() =>
    hashToPage(typeof window !== "undefined" ? window.location.hash : "")
  );

  // Keep state in sync with the URL hash — covers back/forward navigation
  // and manual hash edits. Writing the hash is also cheap, so the click
  // handler below updates both the hash and the state in one go.
  useEffect(() => {
    const onHashChange = () => setActivePage(hashToPage(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleNavSelect = useCallback((pageId) => {
    // Writing to window.location.hash will trigger the hashchange listener
    // above, which calls setActivePage — so we don't duplicate that here.
    // Only write if the hash actually needs to change.
    const target = `#/${pageId}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    } else {
      // If the hash already matches (e.g. user clicks the active pill),
      // the listener won't fire, but we still want the state to be correct
      // in case it drifted.
      setActivePage(pageId);
    }
  }, []);

  // All four source fetches run on mount and stay alive for the life of the
  // session. This means:
  //   - switching pages is instant (data is already cached in hook state)
  //   - a single refresh flushes + refetches everything in parallel
  //   - the last-updated clock in the Header is accurate across all sources
  const yt = useTrending("youtube");
  const hn = useTrending("hackernews");
  const gh = useTrending("github");
  const dt = useTrending("devto");

  // The Header's "last updated" / "next refresh" clock uses YouTube as the
  // primary signal, falling back to whichever source loaded first.
  const lastUpdated = yt.lastUpdated || hn.lastUpdated || gh.lastUpdated || dt.lastUpdated;
  const nextRefresh = yt.nextRefresh || hn.nextRefresh || gh.nextRefresh || dt.nextRefresh;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // manualRefresh flushes ALL caches on the backend, then re-fetches its own
    // source. Fire all four in parallel — only the first flush matters, rest
    // are no-ops.
    await Promise.all([
      yt.manualRefresh(),
      hn.manualRefresh(),
      gh.manualRefresh(),
      dt.manualRefresh(),
    ]);
    setRefreshing(false);
  }, [yt, hn, gh, dt]);

  return (
    <div className="app">
      <ErrorBoundary title="Header failed to load">
        <Header
          lastUpdated={lastUpdated}
          nextRefresh={nextRefresh}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      </ErrorBoundary>

      <main className="dashboard-main">
        <Nav activePage={activePage} onSelect={handleNavSelect} />

        {/* Single-page layout — only the active source renders. Page switches
            are instant because all four useTrending hooks run in parallel
            on mount. */}
        {activePage === "youtube" && (
          <ErrorBoundary title="YouTube section encountered an error">
            <div id="page-youtube" role="tabpanel">
              <YouTube data={yt.data} loading={yt.loading} error={yt.error} />
            </div>
          </ErrorBoundary>
        )}

        {activePage === "hackernews" && (
          <ErrorBoundary title="Hacker News section encountered an error">
            <div id="page-hackernews" role="tabpanel">
              <HackerNews data={hn.data} loading={hn.loading} error={hn.error} />
            </div>
          </ErrorBoundary>
        )}

        {activePage === "github" && (
          <ErrorBoundary title="GitHub Trending section encountered an error">
            <div id="page-github" role="tabpanel">
              <GitHubTrending data={gh.data} loading={gh.loading} error={gh.error} />
            </div>
          </ErrorBoundary>
        )}

        {activePage === "devto" && (
          <ErrorBoundary title="Dev.to section encountered an error">
            <div id="page-devto" role="tabpanel">
              <DevTo data={dt.data} loading={dt.loading} error={dt.error} />
            </div>
          </ErrorBoundary>
        )}
      </main>

      <footer className="app-footer">
        <span>TrendPulse v3.4</span>
        <span className="footer-dot">·</span>
        <span>Auto-refreshes every 30 minutes</span>
        <span className="footer-dot">·</span>
        <span>YouTube · Hacker News · GitHub · Dev.to</span>
      </footer>
    </div>
  );
}
