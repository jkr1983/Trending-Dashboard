import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DevTo from "../../components/DevTo";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeArticle(overrides = {}) {
  return {
    id: 1001,
    rank: 1,
    title: "10 Tips for Better React Code",
    url: "https://dev.to/author/10-tips-abc1",
    description: "A short summary of the article.",
    coverImage: "https://dev.to/cover.jpg",
    tags: ["javascript", "react", "webdev"],
    reactions: 120,
    comments: 18,
    readingTime: 5,
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    author: {
      name: "Jane Dev",
      username: "janedev",
      avatar: "https://dev.to/janedev.jpg",
    },
    ...overrides,
  };
}

function makeArticles(count = 5) {
  return Array.from({ length: count }, (_, i) =>
    makeArticle({ id: i + 1, rank: i + 1, title: `Article ${i + 1}` })
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe("DevTo — loading state", () => {
  test("renders skeleton cards while loading", () => {
    render(<DevTo data={null} loading={true} error={null} />);
    const skeletons = document.querySelectorAll(".dt-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test("does not show article titles while loading", () => {
    render(<DevTo data={null} loading={true} error={null} />);
    expect(screen.queryByText(/Tips for Better React/)).not.toBeInTheDocument();
  });
});

// ─── Section header ───────────────────────────────────────────────────────────

describe("DevTo — section header", () => {
  test("shows 'Dev.to' heading", () => {
    render(<DevTo data={[]} loading={false} error={null} />);
    expect(screen.getByRole("heading", { name: /dev\.to/i })).toBeInTheDocument();
  });

  test("shows 'Top Today' badge", () => {
    render(<DevTo data={[]} loading={false} error={null} />);
    expect(screen.getByText("Top Today")).toBeInTheDocument();
  });

  test("shows link to dev.to", () => {
    render(<DevTo data={[]} loading={false} error={null} />);
    const link = screen.getByRole("link", { name: /dev\.to ↗/i });
    expect(link).toHaveAttribute("href", "https://dev.to");
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("DevTo — error state", () => {
  test("shows error message when error prop is set", () => {
    render(<DevTo data={null} loading={false} error="API rate limited" />);
    expect(screen.getByText(/API rate limited/i)).toBeInTheDocument();
  });

  test("renders no articles when error and no data", () => {
    render(<DevTo data={null} loading={false} error="Failed" />);
    expect(document.querySelectorAll(".dt-article-card").length).toBe(0);
  });
});

// ─── Article rendering ────────────────────────────────────────────────────────

describe("DevTo — article rendering", () => {
  test("renders article title as link to article URL", () => {
    render(<DevTo data={[makeArticle()]} loading={false} error={null} />);
    const card = document.querySelector(".dt-article-card");
    expect(card.tagName).toBe("A");
    expect(card).toHaveAttribute("href", "https://dev.to/author/10-tips-abc1");
    expect(card).toHaveAttribute("target", "_blank");
  });

  test("renders article title text", () => {
    render(<DevTo data={[makeArticle()]} loading={false} error={null} />);
    expect(screen.getByText("10 Tips for Better React Code")).toBeInTheDocument();
  });

  test("renders rank number", () => {
    render(<DevTo data={[makeArticle({ rank: 5 })]} loading={false} error={null} />);
    expect(screen.getByText("#5")).toBeInTheDocument();
  });

  test("renders author name", () => {
    render(<DevTo data={[makeArticle()]} loading={false} error={null} />);
    expect(screen.getByText("Jane Dev")).toBeInTheDocument();
  });

  test("renders reaction count with heart emoji", () => {
    render(<DevTo data={[makeArticle({ reactions: 120 })]} loading={false} error={null} />);
    expect(screen.getByText(/❤️ 120/)).toBeInTheDocument();
  });

  test("renders comment count", () => {
    render(<DevTo data={[makeArticle({ comments: 18 })]} loading={false} error={null} />);
    expect(screen.getByText(/💬 18/)).toBeInTheDocument();
  });

  test("renders reading time", () => {
    render(<DevTo data={[makeArticle({ readingTime: 5 })]} loading={false} error={null} />);
    expect(screen.getByText(/5 min read/i)).toBeInTheDocument();
  });

  test("renders tags with # prefix", () => {
    render(<DevTo data={[makeArticle({ tags: ["javascript", "react"] })]} loading={false} error={null} />);
    expect(screen.getByText("#javascript")).toBeInTheDocument();
    expect(screen.getByText("#react")).toBeInTheDocument();
  });

  test("renders cover image when present", () => {
    render(<DevTo data={[makeArticle()]} loading={false} error={null} />);
    const img = document.querySelector(".dt-cover");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://dev.to/cover.jpg");
  });

  test("does not render cover image when coverImage is null", () => {
    render(<DevTo data={[makeArticle({ coverImage: null })]} loading={false} error={null} />);
    expect(document.querySelector(".dt-cover")).not.toBeInTheDocument();
  });

  test("renders author avatar", () => {
    render(<DevTo data={[makeArticle()]} loading={false} error={null} />);
    const avatar = document.querySelector(".dt-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("src", "https://dev.to/janedev.jpg");
  });

  test("renders all articles", () => {
    render(<DevTo data={makeArticles(15)} loading={false} error={null} />);
    expect(document.querySelectorAll(".dt-article-card").length).toBe(15);
  });

  test("renders gracefully with empty array", () => {
    render(<DevTo data={[]} loading={false} error={null} />);
    expect(document.querySelectorAll(".dt-article-card").length).toBe(0);
  });

  test("renders description text", () => {
    render(<DevTo data={[makeArticle()]} loading={false} error={null} />);
    expect(screen.getByText("A short summary of the article.")).toBeInTheDocument();
  });
});
