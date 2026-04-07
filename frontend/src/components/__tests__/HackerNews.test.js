import React from "react";
import { render, screen } from "@testing-library/react";
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

  test("shows 'Top Stories' badge", () => {
    render(<HackerNews data={[]} loading={false} error={null} />);
    expect(screen.getByText(/Top Stories/i)).toBeInTheDocument();
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

  test("renders rank number", () => {
    render(<HackerNews data={[makeStory({ rank: 3 })]} loading={false} error={null} />);
    expect(screen.getByText("#3")).toBeInTheDocument();
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
    expect(document.querySelectorAll(".hn-story").length).toBe(0);
  });
});
