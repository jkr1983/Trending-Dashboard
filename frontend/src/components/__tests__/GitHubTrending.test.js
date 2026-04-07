import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import GitHubTrending from "../../components/GitHubTrending";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRepo(overrides = {}) {
  return {
    rank: 1,
    fullName: "vercel/next.js",
    owner: "vercel",
    name: "next.js",
    description: "The React Framework for the Web",
    language: "TypeScript",
    stars: 120000,
    forks: 25000,
    starsToday: 350,
    url: "https://github.com/vercel/next.js",
    ...overrides,
  };
}

function makeRepos(count = 5) {
  return Array.from({ length: count }, (_, i) =>
    makeRepo({
      rank: i + 1,
      fullName: `owner${i}/repo${i}`,
      owner: `owner${i}`,
      name: `repo${i}`,
    })
  );
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
    render(<GitHubTrending data={[]} loading={false} error={null} />);
    expect(screen.getByRole("heading", { name: /github trending/i })).toBeInTheDocument();
  });

  test("shows 'Today' badge", () => {
    render(<GitHubTrending data={[]} loading={false} error={null} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  test("shows link to github.com/trending", () => {
    render(<GitHubTrending data={[]} loading={false} error={null} />);
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
    render(<GitHubTrending data={[makeRepo()]} loading={false} error={null} />);
    const card = document.querySelector(".gh-repo-card");
    expect(card.tagName).toBe("A");
    expect(card).toHaveAttribute("href", "https://github.com/vercel/next.js");
    expect(card).toHaveAttribute("target", "_blank");
  });

  test("renders owner and repo name separately", () => {
    render(<GitHubTrending data={[makeRepo()]} loading={false} error={null} />);
    expect(screen.getByText("vercel")).toBeInTheDocument();
    expect(screen.getByText("next.js")).toBeInTheDocument();
  });

  test("renders rank number", () => {
    render(<GitHubTrending data={[makeRepo({ rank: 4 })]} loading={false} error={null} />);
    expect(screen.getByText("#4")).toBeInTheDocument();
  });

  test("renders description", () => {
    render(<GitHubTrending data={[makeRepo()]} loading={false} error={null} />);
    expect(screen.getByText("The React Framework for the Web")).toBeInTheDocument();
  });

  test("renders programming language", () => {
    render(<GitHubTrending data={[makeRepo({ language: "Rust" })]} loading={false} error={null} />);
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  test("renders star count", () => {
    render(<GitHubTrending data={[makeRepo({ stars: 120000 })]} loading={false} error={null} />);
    // formatNum(120000) = "120.0K"
    expect(screen.getByText(/⭐.*120\.0K/)).toBeInTheDocument();
  });

  test("renders starsToday when > 0", () => {
    render(<GitHubTrending data={[makeRepo({ starsToday: 350 })]} loading={false} error={null} />);
    expect(screen.getByText(/\+350 today/)).toBeInTheDocument();
  });

  test("does not render starsToday when 0", () => {
    render(<GitHubTrending data={[makeRepo({ starsToday: 0 })]} loading={false} error={null} />);
    expect(screen.queryByText(/today/)).not.toBeInTheDocument();
  });

  test("renders all repos", () => {
    render(<GitHubTrending data={makeRepos(10)} loading={false} error={null} />);
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(10);
  });

  test("renders gracefully when description is empty", () => {
    render(<GitHubTrending data={[makeRepo({ description: "" })]} loading={false} error={null} />);
    // Should not crash; no description paragraph
    expect(document.querySelector(".gh-description")).not.toBeInTheDocument();
  });

  test("renders gracefully when language is null", () => {
    render(<GitHubTrending data={[makeRepo({ language: null })]} loading={false} error={null} />);
    expect(document.querySelector(".gh-lang")).not.toBeInTheDocument();
  });

  test("renders empty list gracefully", () => {
    render(<GitHubTrending data={[]} loading={false} error={null} />);
    expect(document.querySelectorAll(".gh-repo-card").length).toBe(0);
  });
});
