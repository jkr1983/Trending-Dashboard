import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import HackerNews from "../../components/HackerNews";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStory(overrides = {}) {
  return {
    id: 1,
    rank: 1,
    title: "Show HN: I built a thing",
    url: "https://example.com/thing",
    commentsUrl: "https://news.ycombinator.com/item?id=1",
    score: 450,
    by: "founder",
    descendants: 87,
    time: new Date(Date.now() - 3600000).toISOString(),
    domain: "example.com",
    ...overrides,
  };
}

function makeStories(count = 5) {
  return Array.from({ length: count }, (_, i) =>
    makeStory({ id: i + 1, rank: i + 1, title: `HN Story ${i + 1}`, score: 100 + i })
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe("HackerNews — loading state", () => {
  test("renders skeleton rows while loading", () => {
    render(<HackerNews data={null} loading={true} error={null} />);
    const skeletons = document.querySelectorAll(".skeleton-row");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test("does not show any story titles while loading", () => {
    render(<HackerNews data={null} loading={true} error={null} />);
    expect(screen.queryByText(/HN Story/i)).not.toBeInTheDocument();
  });
});

// ─── Section header ───────────────────────────────────────────────────────────

describe("HackerNews — section header", () => {
  test("shows 'Hacker News' heading", () => {
    render(<HackerNews data={[]} loading={false} error={null} />);
    expect(screen.getByRole("heading", { name: /hacker news/i })).toBeInTheDocument();
  });

  test("shows default 'Top Stories · Past 1 day' badge", () => {
    render(<HackerNews data={[]} loading={false} error={null} />);
    expect(screen.getByText(/Top Stories · Past 1 day/i)).toBeInTheDocument();
  });

  test("badge updates when time-frame dropdown changes", () => {
    render(<HackerNews data={[]} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "5" } });
    expect(screen.getByText(/Top Stories · Past 5 days/i)).toBeInTheDocument();
  });

  test("shows link to news.ycombinator.com", () => {
    render(<HackerNews data={[]} loading={false} error={null} />);
    const link = screen.getByRole("link", { name: /news\.ycombinator\.com/i });
    expect(link).toHaveAttribute("href", "https://news.ycombinator.com");
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("HackerNews — error state", () => {
  test("displays error message when error prop is set", () => {
    render(<HackerNews data={null} loading={false} error="Network timeout" />);
    expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
  });

  test("renders no stories when error and no data", () => {
    render(<HackerNews data={null} loading={false} error="Failed" />);
    expect(document.querySelectorAll(".hn-story").length).toBe(0);
  });
});

// ─── Story rendering ──────────────────────────────────────────────────────────

describe("HackerNews — story rendering", () => {
  test("renders story titles as links to the story URL", () => {
    render(<HackerNews data={[makeStory()]} loading={false} error={null} />);
    const link = screen.getByRole("link", { name: "Show HN: I built a thing" });
    expect(link).toHaveAttribute("href", "https://example.com/thing");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("renders rank starting at #1 (re-numbered after slicing)", () => {
    // The component re-numbers ranks based on the filtered display
    // position, ignoring whatever rank the backend assigned.
    render(<HackerNews data={[makeStory({ rank: 3 })]} loading={false} error={null} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText("#3")).not.toBeInTheDocument();
  });

  test("renders score", () => {
    render(<HackerNews data={[makeStory({ score: 450 })]} loading={false} error={null} />);
    // formatScore(450) = "450"
    expect(screen.getByText(/▲.*450/)).toBeInTheDocument();
  });

  test("renders author name", () => {
    render(<HackerNews data={[makeStory({ by: "pg" })]} loading={false} error={null} />);
    expect(screen.getByText(/by pg/i)).toBeInTheDocument();
  });

  test("renders comment count as link to HN comments", () => {
    render(<HackerNews data={[makeStory()]} loading={false} error={null} />);
    const commentLink = screen.getByRole("link", { name: /💬 87/ });
    expect(commentLink).toHaveAttribute("href", "https://news.ycombinator.com/item?id=1");
  });

  test("renders domain badge", () => {
    render(<HackerNews data={[makeStory({ domain: "github.com" })]} loading={false} error={null} />);
    expect(screen.getByText("github.com")).toBeInTheDocument();
  });

  test("renders all stories in the list", () => {
    render(<HackerNews data={makeStories(10)} loading={false} error={null} />);
    const rows = document.querySelectorAll(".hn-story");
    expect(rows.length).toBe(10);
  });

  test("renders up to 15 stories correctly", () => {
    render(<HackerNews data={makeStories(15)} loading={false} error={null} />);
    const rows = document.querySelectorAll(".hn-story");
    expect(rows.length).toBe(15);
  });

  test("renders empty list gracefully when data is empty array", () => {
    render(<HackerNews data={[]} loading={false} error={null} />);
    // Filtered empty state now renders a message rather than nothing
    expect(screen.getByText(/No stories found/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".hn-story").length).toBe(0);
  });
});

// ─── Filter dropdowns (time frame + count) ───────────────────────────────────

describe("HackerNews — filter dropdowns", () => {
  function makeAgedStory(id, hoursAgo, score) {
    return makeStory({
      id,
      rank: id,
      title: `Story ${id}`,
      time: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
      score,
    });
  }
  function agedData() {
    return [
      makeAgedStory(1,   1,   500),  //   1h
      makeAgedStory(2,  12,   400),  //  12h
      makeAgedStory(3,  23,   300),  //  23h — inside 1-day window
      makeAgedStory(4,  30,   280),  //  30h — outside 1-day, inside 2-day
      makeAgedStory(5,  50,   260),  //  50h — outside 2-day, inside 3-day
      makeAgedStory(6,  95,   240),  //  ~4d — outside 3-day, inside 5-day
      makeAgedStory(7, 170,   220),  //  ~7d — outside 5-day, inside 10-day
      makeAgedStory(8, 430,   200),  // ~18d — outside 10-day, inside 20-day
    ];
  }

  test("default (1 day, 15 stories) shows only stories within 24h", () => {
    render(<HackerNews data={agedData()} loading={false} error={null} />);
    const rows = document.querySelectorAll(".hn-story");
    // Stories 1, 2, 3 are within 24h
    expect(rows.length).toBe(3);
    expect(screen.getByText("Story 1")).toBeInTheDocument();
    expect(screen.getByText("Story 3")).toBeInTheDocument();
    expect(screen.queryByText("Story 4")).not.toBeInTheDocument();
  });

  test("changing time frame to 2 days includes the 30h story", () => {
    render(<HackerNews data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "2" } });
    expect(screen.getByText("Story 4")).toBeInTheDocument();
    expect(screen.queryByText("Story 5")).not.toBeInTheDocument(); // 50h > 48h
  });

  test("changing time frame to 20 days includes all 8 stories (capped by count)", () => {
    render(<HackerNews data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    // 8 eligible stories, default count 15 → all 8 visible
    expect(document.querySelectorAll(".hn-story").length).toBe(8);
  });

  test("changing count to 5 trims the result", () => {
    render(<HackerNews data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/number of stories/i), { target: { value: "5" } });
    expect(document.querySelectorAll(".hn-story").length).toBe(5);
  });

  test("dropdowns are disabled while loading", () => {
    render(<HackerNews data={null} loading={true} error={null} />);
    expect(screen.getByLabelText(/time frame/i)).toBeDisabled();
    expect(screen.getByLabelText(/number of stories/i)).toBeDisabled();
  });

  test("stories with missing time are dropped", () => {
    const data = [
      makeStory({ id: 1, title: "Has Time" }),
      makeStory({ id: 2, title: "No Time", time: null }),
    ];
    render(<HackerNews data={data} loading={false} error={null} />);
    expect(screen.getByText("Has Time")).toBeInTheDocument();
    expect(screen.queryByText("No Time")).not.toBeInTheDocument();
  });

  test("empty state shows when no stories match the window", () => {
    const old = makeStory({
      id: 99,
      title: "Old Story",
      time: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    });
    render(<HackerNews data={[old]} loading={false} error={null} />);
    // Default 1-day window → nothing eligible
    expect(screen.getByText(/No stories found/i)).toBeInTheDocument();
  });

  test("rank re-numbers after filtering", () => {
    // Old stories have rank 7, 8, 9 from the server but after filtering only
    // story 9 (1h old) survives — its displayed rank should be #1.
    const data = [
      makeStory({ id: 1, rank: 7, title: "Old A", time: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() }),
      makeStory({ id: 2, rank: 8, title: "Old B", time: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() }),
      makeStory({ id: 3, rank: 9, title: "Fresh",  time: new Date(Date.now() - 1 * 3600 * 1000).toISOString() }),
    ];
    render(<HackerNews data={data} loading={false} error={null} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText("#9")).not.toBeInTheDocument();
  });
});
