import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import YouTube from "../../components/YouTube";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVideo(overrides = {}) {
  return {
    id: "vid1",
    title: "Test Trending Video",
    channel: "Test Channel",
    thumbnail: "https://img.youtube.com/vi/vid1/hq.jpg",
    views: 1500000,
    likes: 45000,
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    url: "https://www.youtube.com/watch?v=vid1",
    ...overrides,
  };
}

function makeData(overrides = {}) {
  return {
    All:                 [makeVideo({ id: "v1" }), makeVideo({ id: "v2" })],
    Music:               [makeVideo({ id: "v3", title: "Music Video" })],
    Gaming:              [makeVideo({ id: "v4", title: "Gaming Video" })],
    "News & Politics":   [],
    Entertainment:       [],
    Sports:              [],
    Comedy:              [],
    "How-to & Style":    [],
    "People & Blogs":    [],
    "Pets & Animals":    [],
    "Science & Technology": [],
    ...overrides,
  };
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe("YouTube — loading state", () => {
  test("renders 15 skeleton cards while loading", () => {
    render(<YouTube data={null} loading={true} error={null} />);
    // Each skeleton card has a video-thumb-wrap skeleton div
    const skeletons = document.querySelectorAll(".skeleton-card");
    expect(skeletons.length).toBe(15);
  });

  test("does not show any video titles while loading", () => {
    render(<YouTube data={null} loading={true} error={null} />);
    expect(screen.queryByRole("link", { name: /Test Trending Video/ })).not.toBeInTheDocument();
  });

  test("category tabs are disabled during loading", () => {
    render(<YouTube data={null} loading={true} error={null} />);
    const tabs = document.querySelectorAll(".cat-tab");
    tabs.forEach((tab) => expect(tab).toBeDisabled());
  });
});

// ─── Section header ───────────────────────────────────────────────────────────

describe("YouTube — section header", () => {
  test("shows 'YouTube' heading", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    expect(screen.getByRole("heading", { name: /youtube/i })).toBeInTheDocument();
  });

  test("shows 'Trending · Past 24h' badge", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    expect(screen.getByText(/Trending · Past 24h/i)).toBeInTheDocument();
  });

  test("shows link to youtube.com/trending", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    const link = screen.getByRole("link", { name: /youtube\.com\/trending/i });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/feed/trending");
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("YouTube — error state", () => {
  test("shows error message when error is set", () => {
    render(<YouTube data={null} loading={false} error="YouTube API key not configured" />);
    expect(screen.getByText(/YouTube API key not configured/i)).toBeInTheDocument();
  });

  test("does not render video cards when error is set and no data", () => {
    render(<YouTube data={null} loading={false} error="Something went wrong" />);
    expect(document.querySelectorAll(".video-card").length).toBe(0);
  });
});

// ─── Video rendering ──────────────────────────────────────────────────────────

describe("YouTube — video rendering", () => {
  test("renders video titles as links", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    const link = screen.getByRole("link", { name: /Test Trending Video/i });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=v1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("renders rank numbers starting at #1", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  test("renders view and like counts", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    // formatNum(1500000) = "1.5M"
    expect(screen.getAllByText(/1\.5M/i).length).toBeGreaterThan(0);
  });

  test("renders thumbnail images when URL is valid", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    const imgs = document.querySelectorAll(".video-thumb-wrap img");
    expect(imgs.length).toBeGreaterThan(0);
  });

  test("shows placeholder when thumbnail URL is missing", () => {
    const data = makeData({ All: [makeVideo({ thumbnail: null })] });
    render(<YouTube data={data} loading={false} error={null} />);
    expect(document.querySelector(".video-thumb-placeholder")).toBeInTheDocument();
  });

  test("shows empty state when category has no videos", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    // Switch to a category with no videos
    fireEvent.click(screen.getByText("News & Politics"));
    expect(screen.getByText(/No videos found/i)).toBeInTheDocument();
  });
});

// ─── Category switching ───────────────────────────────────────────────────────

describe("YouTube — category switching", () => {
  test("renders a tab for each category in data", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Music" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gaming" })).toBeInTheDocument();
  });

  test("clicking a category tab switches displayed videos", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    expect(screen.getByText("Test Trending Video")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Music" }));
    expect(screen.getByText("Music Video")).toBeInTheDocument();
    expect(screen.queryByText("Test Trending Video")).not.toBeInTheDocument();
  });

  test("active tab has yt-active class", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    const allTab = screen.getByRole("button", { name: "All" });
    expect(allTab.className).toMatch(/yt-active/);
    fireEvent.click(screen.getByRole("button", { name: "Music" }));
    expect(screen.getByRole("button", { name: "Music" }).className).toMatch(/yt-active/);
    expect(screen.getByRole("button", { name: "All" }).className).not.toMatch(/yt-active/);
  });
});
