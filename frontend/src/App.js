import React, { useState, useCallback } from "react";
import Header from "./components/Header";
import YouTube from "./components/YouTube";
import HackerNews from "./components/HackerNews";
import GitHubTrending from "./components/GitHubTrending";
import DevTo from "./components/DevTo";
import ErrorBoundary from "./components/ErrorBoundary";
import { useTrending } from "./hooks/useTrending";
import "./App.css";

export default function App() {
  const [refreshing, setRefreshing] = useState(false);

  const yt = useTrending("youtube");
  const hn = useTrending("hackernews");
  const gh = useTrending("github");
  const dt = useTrending("devto");

  // Use YouTube's lastUpdated/nextRefresh as the primary clock in the header
  const lastUpdated = yt.lastUpdated || hn.lastUpdated || gh.lastUpdated || dt.lastUpdated;
  const nextRefresh = yt.nextRefresh || hn.nextRefresh || gh.nextRefresh || dt.nextRefresh;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // manualRefresh flushes ALL caches on the backend, then re-fetches its own source.
    // Fire all four in parallel — only the first flush matters, rest are no-ops.
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
        {/* YouTube — full width, has its own category tabs */}
        <ErrorBoundary title="YouTube section encountered an error">
          <YouTube data={yt.data} loading={yt.loading} error={yt.error} />
        </ErrorBoundary>

        {/* Three-column row: HN · GitHub · Dev.to */}
        <div className="dashboard-grid">
          <ErrorBoundary title="Hacker News section encountered an error">
            <HackerNews data={hn.data} loading={hn.loading} error={hn.error} />
          </ErrorBoundary>

          <ErrorBoundary title="GitHub Trending section encountered an error">
            <GitHubTrending data={gh.data} loading={gh.loading} error={gh.error} />
          </ErrorBoundary>

          <ErrorBoundary title="Dev.to section encountered an error">
            <DevTo data={dt.data} loading={dt.loading} error={dt.error} />
          </ErrorBoundary>
        </div>
      </main>

      <footer className="app-footer">
        <span>TrendPulse v3.0</span>
        <span className="footer-dot">·</span>
        <span>Auto-refreshes every 30 minutes</span>
        <span className="footer-dot">·</span>
        <span>YouTube · Hacker News · GitHub · Dev.to</span>
      </footer>
    </div>
  );
}
