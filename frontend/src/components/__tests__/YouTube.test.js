import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import YouTube from "../../components/YouTube";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVideo(overrides = {}) {
  const id = overrides.id ?? "vid1";
  return {
    id,
    title: "Test Trending Video",
    channel: "Test Channel",
    thumbnail: `https://img.youtube.com/vi/${id}/hq.jpg`,
    views: 1500000,
    likes: 45000,
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    url: `https://www.youtube.com/watch?v=${id}`,
    ...overrides,
  };
}

function makeData(overrides = {}) {
  return {
    // Two videos with distinct titles so getByText/getByRole queries in the
    // "All" category never match more than one element.
    All:                 [
      makeVideo({ id: "v1", title: "Test Trending Video" }),
      makeVideo({ id: "v2", title: "Second All Video"   }),
    ],
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

  test("shows default 'Trending · Past 1 day' badge", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    expect(screen.getByText(/Trending · Past 1 day/i)).toBeInTheDocument();
  });

  test("badge updates when time-frame dropdown changes", () => {
    render(<YouTube data={makeData()} loading={false} error={null} />);
    const timeFrameSelect = screen.getByLabelText(/time frame/i);
    fireEvent.change(timeFrameSelect, { target: { value: "10" } });
    expect(screen.getByText(/Trending · Past 10 days/i)).toBeInTheDocument();
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

// ─── Filter dropdowns (time frame + count) ───────────────────────────────────

describe("YouTube — filter dropdowns", () => {
  // Build "All" category with 20 videos of varying ages so we can assert
  // on filtering behaviour. Views descend with index so sort order is stable.
  function makeAgedVideo(id, hoursAgo, views) {
    return makeVideo({
      id,
      title: `Video ${id}`,
      publishedAt: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
      views,
    });
  }
  function agedData() {
    const all = [
      makeAgedVideo("fresh1", 1,   500000),  //   1h
      makeAgedVideo("fresh2", 12,  400000),  //  12h
      makeAgedVideo("fresh3", 23,  300000),  //  23h  — inside 1-day window
      makeAgedVideo("mid1",   30,  280000),  //  30h  — outside 1-day, inside 2-day
      makeAgedVideo("mid2",   50,  260000),  //  50h  — outside 2-day, inside 3-day
      makeAgedVideo("mid3",   95,  240000),  //  ~4d  — outside 3-day, inside 5-day
      makeAgedVideo("old1",  170,  220000),  //  ~7d  — outside 5-day, inside 10-day
      makeAgedVideo("old2",  430,  200000),  // ~18d  — outside 10-day, inside 20-day
      makeAgedVideo("older1", 60,  180000),  //  60h
      makeAgedVideo("older2", 80,  160000),  //  80h
      makeAgedVideo("older3", 100, 140000),  // 100h
      makeAgedVideo("older4", 120, 120000),  // 120h  = 5d exactly
      makeAgedVideo("older5", 150, 100000),  // 150h
      makeAgedVideo("older6", 200,  90000),  // ~8d
      makeAgedVideo("older7", 250,  80000),  // ~10d
      makeAgedVideo("older8", 300,  70000),  // ~12d
      makeAgedVideo("older9", 350,  60000),  // ~14d
      makeAgedVideo("olderA", 400,  50000),  // ~16d
      makeAgedVideo("olderB", 450,  40000),  // ~18d
      makeAgedVideo("olderC", 475,  30000),  // ~19d
    ];
    return makeData({ All: all });
  }

  test("default (1 day, 15 videos) shows only the three videos within 24h", () => {
    render(<YouTube data={agedData()} loading={false} error={null} />);
    const cards = document.querySelectorAll(".video-card");
    // fresh1, fresh2, fresh3 — the three with hoursAgo ≤ 24
    expect(cards.length).toBe(3);
    expect(screen.getByText("Video fresh1")).toBeInTheDocument();
    expect(screen.getByText("Video fresh3")).toBeInTheDocument();
    expect(screen.queryByText("Video mid1")).not.toBeInTheDocument(); // 30h > 24h
  });

  test("changing time frame to 2 days includes the 30h video", () => {
    render(<YouTube data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "2" } });
    expect(screen.getByText("Video mid1")).toBeInTheDocument();
    expect(screen.queryByText("Video mid2")).not.toBeInTheDocument(); // 50h > 48h
  });

  test("changing time frame to 3 days includes 30h and 50h videos", () => {
    render(<YouTube data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "3" } });
    expect(screen.getByText("Video mid1")).toBeInTheDocument();
    expect(screen.getByText("Video mid2")).toBeInTheDocument();
    expect(screen.queryByText("Video mid3")).not.toBeInTheDocument(); // 95h > 72h
  });

  test("changing time frame to 20 days includes all 20 videos (capped by count default of 15)", () => {
    render(<YouTube data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    // 20 eligible videos, capped at 15 by the default count
    expect(document.querySelectorAll(".video-card").length).toBe(15);
  });

  test("changing count to 5 trims the result", () => {
    render(<YouTube data={agedData()} loading={false} error={null} />);
    // Widen the time frame so there's plenty to trim
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/number of videos/i), { target: { value: "5" } });
    expect(document.querySelectorAll(".video-card").length).toBe(5);
  });

  test("changing count to 50 shows all eligible videos up to 50", () => {
    render(<YouTube data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/number of videos/i), { target: { value: "50" } });
    // All 20 fixtures should render (< 50)
    expect(document.querySelectorAll(".video-card").length).toBe(20);
  });

  test("dropdowns are disabled while loading", () => {
    render(<YouTube data={null} loading={true} error={null} />);
    expect(screen.getByLabelText(/time frame/i)).toBeDisabled();
    expect(screen.getByLabelText(/number of videos/i)).toBeDisabled();
  });

  test("videos with missing publishedAt are dropped", () => {
    const data = makeData({
      All: [
        makeVideo({ id: "hasDate", title: "Has Date" }),
        makeVideo({ id: "noDate",  title: "No Date", publishedAt: null }),
      ],
    });
    render(<YouTube data={data} loading={false} error={null} />);
    expect(screen.getByText("Has Date")).toBeInTheDocument();
    expect(screen.queryByText("No Date")).not.toBeInTheDocument();
  });

  test("empty state shows when no videos are within the selected window", () => {
    // Build data where every video is 10+ days old
    const old = makeVideo({
      id: "veryOld",
      publishedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    });
    const data = makeData({ All: [old] });
    render(<YouTube data={data} loading={false} error={null} />);
    // Default is 1 day — nothing eligible
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
