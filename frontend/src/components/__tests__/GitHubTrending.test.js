import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import GitHubTrending from "../../components/GitHubTrending";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRepo(overrides = {}) {
  const owner = overrides.owner ?? "vercel";
  const name  = overrides.name  ?? "next.js";
  return {
    rank: 1,
    fullName: `${owner}/${name}`,
    owner,
    name,
    description: "The React Framework for the Web",
    language: "TypeScript",
    stars: 120000,
    forks: 25000,
    starsToday: 350,
    url: `https://github.com/${owner}/${name}`,
    ...overrides,
  };
}

function makeRepos(count = 5, prefix = "") {
  return Array.from({ length: count }, (_, i) =>
    makeRepo({
      rank: i + 1,
      owner: `${prefix}owner${i}`,
      name:  `${prefix}repo${i}`,
    })
  );
}

// Wraps a repo list into the new { daily, weekly, monthly } bucket shape.
// By default the same list is used for all three buckets — pass explicit
// weekly/monthly overrides if you need to test bucket switching.
function makeBuckets(daily, weekly, monthly) {
  return {
    daily:   daily   || [],
    weekly:  weekly  || daily || [],
    monthly: monthly || weekly || daily || [],
  };
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe("GitHubTrending — loading state", () => {
  test("renders skeleton cards while loading", () => {
    render(<GitHubTrending data={null} loading={true} error={null} />);
    const skeletons = document.querySelectorAll(".gh-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test("does not show repo names while loading", () => {
    render(<GitHubTrending data={null} loading={true} error={null} />);
    expect(screen.queryByText("next.js")).not.toBeInTheDocument();
  });
});

// ─── Section header ───────────────────────────────────────────────────────────

describe("GitHubTrending — section header", () => {
  test("shows 'GitHub Trending' heading", () => {
    render(<GitHubTrending data={makeBuckets([])} loading={false} error={null} />);
    expect(screen.getByRole("heading", { name: /github trending/i })).toBeInTheDocument();
  });

  test("shows default 'Daily' badge for the 1-day time frame", () => {
    render(<GitHubTrending data={makeBuckets([])} loading={false} error={null} />);
    // Badge reads: "Trending · Daily · Past 1 day"
    expect(screen.getByText(/Trending · Daily · Past 1 day/i)).toBeInTheDocument();
  });

  test("shows link to github.com/trending", () => {
    render(<GitHubTrending data={makeBuckets([])} loading={false} error={null} />);
    const link = screen.getByRole("link", { name: /github\.com\/trending/i });
    expect(link).toHaveAttribute("href", "https://github.com/trending");
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("GitHubTrending — error state", () => {
  test("shows error message when error prop is set", () => {
    render(<GitHubTrending data={null} loading={false} error="Scrape failed" />);
    expect(screen.getByText(/Scrape failed/i)).toBeInTheDocument();
  });

  test("renders no repo cards when error and no data", () => {
    render(<GitHubTrending data={null} loading={false} error="Failed" />);
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(0);
  });
});

// ─── Repo rendering ───────────────────────────────────────────────────────────

describe("GitHubTrending — repo rendering", () => {
  test("renders repo as link to GitHub URL", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo()])} loading={false} error={null} />);
    const card = document.querySelector(".gh-repo-card");
    expect(card.tagName).toBe("A");
    expect(card).toHaveAttribute("href", "https://github.com/vercel/next.js");
    expect(card).toHaveAttribute("target", "_blank");
  });

  test("renders owner and repo name separately", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo()])} loading={false} error={null} />);
    expect(screen.getByText("vercel")).toBeInTheDocument();
    expect(screen.getByText("next.js")).toBeInTheDocument();
  });

  test("renders rank number starting at #1 (re-numbered after slicing)", () => {
    // Pre-sliced rank doesn't matter — the component re-numbers based on
    // displayed position.
    const data = makeBuckets([makeRepo({ rank: 17 })]);
    render(<GitHubTrending data={data} loading={false} error={null} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText("#17")).not.toBeInTheDocument();
  });

  test("renders description", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo()])} loading={false} error={null} />);
    expect(screen.getByText("The React Framework for the Web")).toBeInTheDocument();
  });

  test("renders programming language", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo({ language: "Rust" })])} loading={false} error={null} />);
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  test("renders star count", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo({ stars: 120000 })])} loading={false} error={null} />);
    // formatNum(120000) = "120.0K"
    expect(screen.getByText(/⭐.*120\.0K/)).toBeInTheDocument();
  });

  test("renders starsToday when > 0", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo({ starsToday: 350 })])} loading={false} error={null} />);
    expect(screen.getByText(/\+350 today/)).toBeInTheDocument();
  });

  test("does not render starsToday when 0", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo({ starsToday: 0 })])} loading={false} error={null} />);
    expect(screen.queryByText(/today/)).not.toBeInTheDocument();
  });

  test("renders all repos up to default count 15", () => {
    render(<GitHubTrending data={makeBuckets(makeRepos(10))} loading={false} error={null} />);
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(10);
  });

  test("renders gracefully when description is empty", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo({ description: "" })])} loading={false} error={null} />);
    expect(document.querySelector(".gh-description")).not.toBeInTheDocument();
  });

  test("renders gracefully when language is null", () => {
    render(<GitHubTrending data={makeBuckets([makeRepo({ language: null })])} loading={false} error={null} />);
    expect(document.querySelector(".gh-lang")).not.toBeInTheDocument();
  });

  test("renders empty state gracefully", () => {
    render(<GitHubTrending data={makeBuckets([])} loading={false} error={null} />);
    expect(screen.getByText(/No repos found/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(0);
  });
});

// ─── Filter dropdowns (time frame → bucket + count) ──────────────────────────

describe("GitHubTrending — filter dropdowns", () => {
  test("1 day picks the daily bucket", () => {
    const data = makeBuckets(
      [makeRepo({ owner: "d", name: "daily-only" })],
      [makeRepo({ owner: "w", name: "weekly-only" })],
      [makeRepo({ owner: "m", name: "monthly-only" })],
    );
    render(<GitHubTrending data={data} loading={false} error={null} />);
    expect(screen.getByText("daily-only")).toBeInTheDocument();
    expect(screen.queryByText("weekly-only")).not.toBeInTheDocument();
  });

  test("2 days picks the weekly bucket", () => {
    const data = makeBuckets(
      [makeRepo({ owner: "d", name: "daily-only" })],
      [makeRepo({ owner: "w", name: "weekly-only" })],
      [makeRepo({ owner: "m", name: "monthly-only" })],
    );
    render(<GitHubTrending data={data} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "2" } });
    expect(screen.getByText("weekly-only")).toBeInTheDocument();
    expect(screen.queryByText("daily-only")).not.toBeInTheDocument();
  });

  test("3 days picks the weekly bucket", () => {
    const data = makeBuckets(
      [makeRepo({ owner: "d", name: "daily-only" })],
      [makeRepo({ owner: "w", name: "weekly-only" })],
      [makeRepo({ owner: "m", name: "monthly-only" })],
    );
    render(<GitHubTrending data={data} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "3" } });
    expect(screen.getByText("weekly-only")).toBeInTheDocument();
  });

  test("5 days picks the monthly bucket", () => {
    const data = makeBuckets(
      [makeRepo({ owner: "d", name: "daily-only" })],
      [makeRepo({ owner: "w", name: "weekly-only" })],
      [makeRepo({ owner: "m", name: "monthly-only" })],
    );
    render(<GitHubTrending data={data} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "5" } });
    expect(screen.getByText("monthly-only")).toBeInTheDocument();
    expect(screen.queryByText("weekly-only")).not.toBeInTheDocument();
  });

  test("10 and 20 days both pick the monthly bucket", () => {
    const data = makeBuckets(
      [makeRepo({ owner: "d", name: "daily-only" })],
      [makeRepo({ owner: "w", name: "weekly-only" })],
      [makeRepo({ owner: "m", name: "monthly-only" })],
    );
    const { rerender } = render(
      <GitHubTrending data={data} loading={false} error={null} />
    );
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "10" } });
    expect(screen.getByText("monthly-only")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    expect(screen.getByText("monthly-only")).toBeInTheDocument();
    rerender(<GitHubTrending data={data} loading={false} error={null} />);
  });

  test("count dropdown slices the active bucket", () => {
    const data = makeBuckets(makeRepos(25));
    render(<GitHubTrending data={data} loading={false} error={null} />);
    // default count is 15
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(15);
    fireEvent.change(screen.getByLabelText(/number of repos/i), { target: { value: "5" } });
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(5);
    fireEvent.change(screen.getByLabelText(/number of repos/i), { target: { value: "25" } });
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(25);
  });

  test("badge reflects selected bucket", () => {
    render(<GitHubTrending data={makeBuckets([])} loading={false} error={null} />);
    expect(screen.getByText(/Trending · Daily · Past 1 day/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "3" } });
    expect(screen.getByText(/Trending · Weekly · Past 3 days/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    expect(screen.getByText(/Trending · Monthly · Past 20 days/i)).toBeInTheDocument();
  });

  test("dropdowns are disabled while loading", () => {
    render(<GitHubTrending data={null} loading={true} error={null} />);
    expect(screen.getByLabelText(/time frame/i)).toBeDisabled();
    expect(screen.getByLabelText(/number of repos/i)).toBeDisabled();
  });

  test("empty bucket shows empty state message", () => {
    // Daily is empty; user is on default 1-day (daily) → should show empty state
    const data = makeBuckets([], makeRepos(3), makeRepos(5));
    render(<GitHubTrending data={data} loading={false} error={null} />);
    expect(screen.getByText(/No repos found/i)).toBeInTheDocument();
  });
});
