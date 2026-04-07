import React, { useState, useCallback } from "react";
import Header from "./components/Header";
import YouTube from "./components/YouTube";
import ErrorBoundary from "./components/ErrorBoundary";
import { useTrending } from "./hooks/useTrending";
import "./App.css";

export default function App() {
  const [refreshing, setRefreshing] = useState(false);
  const yt = useTrending("youtube");

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await yt.manualRefresh();
    setRefreshing(false);
  }, [yt]);

  return (
    <div className="app">
      <ErrorBoundary title="Header failed to load">
        <Header
          lastUpdated={yt.lastUpdated}
          nextRefresh={yt.nextRefresh}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      </ErrorBoundary>

      <main className="dashboard-main">
        <ErrorBoundary title="YouTube section encountered an error">
          <YouTube data={yt.data} loading={yt.loading} error={yt.error} />
        </ErrorBoundary>
      </main>

      <footer className="app-footer">
        <span>TrendPulse v2.0</span>
        <span className="footer-dot">·</span>
        <span>Auto-refreshes every 30 minutes</span>
        <span className="footer-dot">·</span>
        <span>Powered by YouTube Data API</span>
      </footer>
    </div>
  );
}
