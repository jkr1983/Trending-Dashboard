import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import YouTube from "../YouTube";

const mockData = {
  All: [
    {
      id: "v1",
      title: "Amazing Trending Video",
      channel: "Top Channel",
      thumbnail: "https://img.youtube.com/vi/v1/hq.jpg",
      views: 2000000,
      likes: 50000,
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      url: "https://www.youtube.com/watch?v=v1",
    },
    {
      id: "v2",
      title: "Another Great Video",
      channel: "Another Channel",
      thumbnail: null,
      views: 500000,
      likes: 10000,
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      url: "https://www.youtube.com/watch?v=v2",
    },
  ],
  Gaming: [
    {
      id: "g1",
      title: "Best Gaming Video",
      channel: "Game Channel",
      thumbnail: "https://img.youtube.com/vi/g1/hq.jpg",
      views: 1000000,
      likes: 30000,
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
      url: "https://www.youtube.com/watch?v=g1",
    },
  ],
};

describe("YouTube component", () => {
  // ─── Loading state ──────────────────────────────────────────────────────────
  describe("Loading state", () => {
    test("renders skeleton cards when loading", () => {
      const { container } = render(<YouTube data={null} loading={true} error={null} />);
      const skeletons = container.querySelectorAll(".skeleton-card");
      expect(skeletons.length).toBe(10);
    });

    test("does not render real video cards while loading", () => {
      render(<YouTube data={null} loading={true} error={null} />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  // ─── Error state ────────────────────────────────────────────────────────────
  describe("Error state", () => {
    test("renders error message when error is set", () => {
      render(<YouTube data={null} loading={false} error="YouTube API quota exceeded" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/quota exceeded/i)).toBeInTheDocument();
    });

    test("does not show error box when error is null", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // ─── Data rendering ─────────────────────────────────────────────────────────
  describe("Data rendering", () => {
    test("renders category tabs from data keys", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Gaming" })).toBeInTheDocument();
    });

    test("renders videos for the default (All) category", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      expect(screen.getByText("Amazing Trending Video")).toBeInTheDocument();
      expect(screen.getByText("Another Great Video")).toBeInTheDocument();
    });

    test("renders video as a link to YouTube", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      const links = screen.getAllByRole("link");
      expect(links[0]).toHaveAttribute("href", "https://www.youtube.com/watch?v=v1");
      expect(links[0]).toHaveAttribute("target", "_blank");
    });

    test("shows rank numbers for each video", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      expect(screen.getByText("#1")).toBeInTheDocument();
      expect(screen.getByText("#2")).toBeInTheDocument();
    });

    test("displays formatted view counts", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      expect(screen.getByText(/2\.0M/)).toBeInTheDocument();
    });

    test("renders placeholder when thumbnail is null", () => {
      const { container } = render(<YouTube data={mockData} loading={false} error={null} />);
      const placeholders = container.querySelectorAll(".video-thumb-placeholder");
      expect(placeholders.length).toBeGreaterThan(0);
    });

    test("shows empty state message when category has no videos", () => {
      const emptyData = { All: [], Gaming: [] };
      render(<YouTube data={emptyData} loading={false} error={null} />);
      expect(screen.getByText(/no videos found/i)).toBeInTheDocument();
    });
  });

  // ─── Category switching ──────────────────────────────────────────────────────
  describe("Category switching", () => {
    test("switches content when a different category tab is clicked", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      expect(screen.getByText("Amazing Trending Video")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: "Gaming" }));
      expect(screen.getByText("Best Gaming Video")).toBeInTheDocument();
      expect(screen.queryByText("Amazing Trending Video")).not.toBeInTheDocument();
    });

    test("active tab has aria-selected=true", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      const allTab = screen.getByRole("tab", { name: "All" });
      expect(allTab).toHaveAttribute("aria-selected", "true");
    });

    test("inactive tab has aria-selected=false", () => {
      render(<YouTube data={mockData} loading={false} error={null} />);
      const gamingTab = screen.getByRole("tab", { name: "Gaming" });
      expect(gamingTab).toHaveAttribute("aria-selected", "false");
    });
  });
});
