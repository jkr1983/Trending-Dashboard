import React from "react";
import { useCountdown } from "../hooks/useTrending";
import "./Header.css";

export default function Header({ lastUpdated, nextRefresh, onRefresh, refreshing }) {
  const countdown = useCountdown(nextRefresh);

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon"><span>📡</span></div>
          <div>
            <h1 className="logo-title">TREND<span className="logo-accent">PULSE</span></h1>
            <p className="logo-sub">Live Trending Dashboard</p>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="status-grid">
          {lastUpdated && (
            <div className="status-item">
              <span className="status-dot active" />
              <div>
                <p className="status-label">Last Updated</p>
                <p className="status-value">{lastUpdated.toLocaleTimeString()}</p>
              </div>
            </div>
          )}
          {nextRefresh && (
            <div className="status-item">
              <span className="status-dot pulse" />
              <div>
                <p className="status-label">Next Refresh</p>
                <p className="status-value countdown">{countdown}</p>
              </div>
            </div>
          )}
        </div>

        <button
          className={`refresh-btn${refreshing ? " refreshing" : ""}`}
          onClick={onRefresh}
          disabled={refreshing}
          title="Force refresh all sources"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            width="16" height="16" className={refreshing ? "spin" : ""}>
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh Now"}
        </button>
      </div>
    </header>
  );
}
