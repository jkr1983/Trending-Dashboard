import { renderHook, act, waitFor } from "@testing-library/react";
import { useTrending } from "../../hooks/useTrending";

// ─── Mock fetch globally ──────────────────────────────────────────────────────

const mockData = {
  All: [{ id: "v1", title: "Trending Video", views: 2000000 }],
  Gaming: [{ id: "v2", title: "Gaming Video", views: 500000 }],
};

function mockFetchSuccess(data = mockData) {
  global.fetch = jest.fn((url) => {
    if (url.includes("/api/refresh")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: "cleared" }) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data, cachedAt: null }),
    });
  });
}

function mockFetchFailure(statusText = "Internal Server Error") {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: statusText }),
    })
  );
}

function mockFetchNetworkError() {
  global.fetch = jest.fn(() => Promise.reject(new Error("Network error")));
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

// ─── Initial load ─────────────────────────────────────────────────────────────

describe("useTrending — initial load", () => {
  test("starts in loading state", () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useTrending("youtube"));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("populates data after successful fetch", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  test("sets error on failed fetch", async () => {
    mockFetchFailure("Service Unavailable");
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Service Unavailable");
    expect(result.current.data).toBeNull();
  });

  test("sets error message on network failure", async () => {
    mockFetchNetworkError();
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");
    expect(result.current.data).toBeNull();
  });

  test("sets lastUpdated timestamp after successful fetch", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  test("sets nextRefresh to ~30 minutes in the future", async () => {
    mockFetchSuccess();
    const before = Date.now();
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const nextMs = result.current.nextRefresh?.getTime();
    expect(nextMs).toBeGreaterThan(before + 29 * 60 * 1000);
    expect(nextMs).toBeLessThan(before + 31 * 60 * 1000);
  });

  test("calls the correct API endpoint for the platform", async () => {
    mockFetchSuccess();
    renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/youtube"));
  });
});

// ─── Auto-refresh ─────────────────────────────────────────────────────────────

describe("useTrending — auto-refresh", () => {
  test("re-fetches after 30 minutes", async () => {
    mockFetchSuccess();
    renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    act(() => jest.advanceTimersByTime(30 * 60 * 1000));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test("does NOT re-fetch before 30 minutes", async () => {
    mockFetchSuccess();
    renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    act(() => jest.advanceTimersByTime(25 * 60 * 1000));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── manualRefresh ────────────────────────────────────────────────────────────

describe("useTrending — manualRefresh", () => {
  test("calls /api/refresh then re-fetches data", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.manualRefresh();
    });

    // First call = initial load, second = /api/refresh, third = re-fetch
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const calls = global.fetch.mock.calls.map((c) => c[0]);
    expect(calls.some((url) => url.includes("/api/refresh"))).toBe(true);
  });

  test("resets loading state during manual refresh", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.manualRefresh(); });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test("clears previous error on manual refresh success", async () => {
    mockFetchFailure("Error");
    const { result } = renderHook(() => useTrending("youtube"));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    mockFetchSuccess(); // Now succeeds
    await act(async () => { await result.current.manualRefresh(); });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.data).toEqual(mockData);
  });
});
