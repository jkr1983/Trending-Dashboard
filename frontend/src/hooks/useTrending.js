import { useState, useEffect, useCallback } from "react";

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useTrending(platform) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${platform}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
      setLastUpdated(new Date());
      setNextRefresh(new Date(Date.now() + REFRESH_INTERVAL));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // manualRefresh clears ALL source caches on the backend, then re-fetches this source
  const manualRefresh = useCallback(async () => {
    await fetch("/api/refresh");
    fetchData();
  }, [fetchData]);

  return { data, loading, error, lastUpdated, nextRefresh, manualRefresh };
}

export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = Math.max(0, targetDate - Date.now());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}
