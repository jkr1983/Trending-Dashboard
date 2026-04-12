import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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

  test("shows default 'Top · Past 1 day' badge", () => {
    render(<DevTo data={[]} loading={false} error={null} />);
    expect(screen.getByText(/Top · Past 1 day/i)).toBeInTheDocument();
  });

  test("badge updates when time-frame dropdown changes", () => {
    render(<DevTo data={[]} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "10" } });
    expect(screen.getByText(/Top · Past 10 days/i)).toBeInTheDocument();
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

  test("renders rank starting at #1 (re-numbered after slicing)", () => {
    // The component re-numbers ranks based on the filtered display position,
    // ignoring whatever rank the backend assigned.
    render(<DevTo data={[makeArticle({ rank: 5 })]} loading={false} error={null} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText("#5")).not.toBeInTheDocument();
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

  test("renders empty state gracefully", () => {
    render(<DevTo data={[]} loading={false} error={null} />);
    expect(screen.getByText(/No articles found/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".dt-article-card").length).toBe(0);
  });

  test("renders description text", () => {
    render(<DevTo data={[makeArticle()]} loading={false} error={null} />);
    expect(screen.getByText("A short summary of the article.")).toBeInTheDocument();
  });
});

// ─── Filter dropdowns (time frame + count) ───────────────────────────────────

describe("DevTo — filter dropdowns", () => {
  function makeAgedArticle(id, hoursAgo) {
    return makeArticle({
      id,
      rank: id,
      title: `Article ${id}`,
      publishedAt: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
    });
  }
  function agedData() {
    return [
      makeAgedArticle(1,   2),  //   2h
      makeAgedArticle(2,  20),  //  20h — inside 1-day
      makeAgedArticle(3,  40),  //  40h — outside 1-day, inside 2-day
      makeAgedArticle(4,  60),  //  60h — outside 2-day, inside 3-day
      makeAgedArticle(5, 100),  // ~4d — outside 3-day, inside 5-day
      makeAgedArticle(6, 200),  // ~8d — outside 5-day, inside 10-day
      makeAgedArticle(7, 430),  // ~18d — outside 10-day, inside 20-day
    ];
  }

  test("default (1 day, 15 articles) shows only articles within 24h", () => {
    render(<DevTo data={agedData()} loading={false} error={null} />);
    const cards = document.querySelectorAll(".dt-article-card");
    expect(cards.length).toBe(2);
    expect(screen.getByText("Article 1")).toBeInTheDocument();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
    expect(screen.queryByText("Article 3")).not.toBeInTheDocument();
  });

  test("changing time frame to 3 days includes 40h and 60h articles", () => {
    render(<DevTo data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "3" } });
    expect(screen.getByText("Article 3")).toBeInTheDocument();
    expect(screen.getByText("Article 4")).toBeInTheDocument();
    expect(screen.queryByText("Article 5")).not.toBeInTheDocument(); // 100h > 72h
  });

  test("changing time frame to 20 days includes all 7 articles (capped by count)", () => {
    render(<DevTo data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    expect(document.querySelectorAll(".dt-article-card").length).toBe(7);
  });

  test("count dropdown trims the result", () => {
    render(<DevTo data={agedData()} loading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/time frame/i), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/number of articles/i), { target: { value: "5" } });
    expect(document.querySelectorAll(".dt-article-card").length).toBe(5);
  });

  test("dropdowns are disabled while loading", () => {
    render(<DevTo data={null} loading={true} error={null} />);
    expect(screen.getByLabelText(/time frame/i)).toBeDisabled();
    expect(screen.getByLabelText(/number of articles/i)).toBeDisabled();
  });

  test("articles with missing publishedAt are dropped", () => {
    const data = [
      makeArticle({ id: 1, title: "Has Date" }),
      makeArticle({ id: 2, title: "No Date", publishedAt: null }),
    ];
    render(<DevTo data={data} loading={false} error={null} />);
    expect(screen.getByText("Has Date")).toBeInTheDocument();
    expect(screen.queryByText("No Date")).not.toBeInTheDocument();
  });

  test("empty state shows when no articles match the window", () => {
    const old = makeArticle({
      id: 99,
      title: "Old Article",
      publishedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    });
    render(<DevTo data={[old]} loading={false} error={null} />);
    expect(screen.getByText(/No articles found/i)).toBeInTheDocument();
  });
});
