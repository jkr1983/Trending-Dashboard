import { formatNum, timeAgo, truncate, formatScore, isValidThumbnail, formatCountdown } from "../../utils/formatters";

// ─── formatNum ────────────────────────────────────────────────────────────────
describe("formatNum", () => {
  test("formats millions with one decimal", () => {
    expect(formatNum(1500000)).toBe("1.5M");
    expect(formatNum(2000000)).toBe("2.0M");
    expect(formatNum(10000000)).toBe("10.0M");
  });

  test("formats thousands with one decimal", () => {
    expect(formatNum(12500)).toBe("12.5K");
    expect(formatNum(1000)).toBe("1.0K");
    expect(formatNum(999999)).toBe("1000.0K");
  });

  test("returns plain string for numbers under 1000", () => {
    expect(formatNum(0)).toBe("0");
    expect(formatNum(500)).toBe("500");
    expect(formatNum(999)).toBe("999");
  });

  test("handles null and undefined safely", () => {
    expect(formatNum(null)).toBe("0");
    expect(formatNum(undefined)).toBe("0");
  });

  test("handles NaN safely", () => {
    expect(formatNum(NaN)).toBe("0");
  });
});

// ─── formatScore ─────────────────────────────────────────────────────────────
describe("formatScore", () => {
  test("formats thousands with k suffix", () => {
    expect(formatScore(12500)).toBe("12.5k");
    expect(formatScore(1000)).toBe("1.0k");
  });

  test("returns plain string under 1000", () => {
    expect(formatScore(999)).toBe("999");
    expect(formatScore(0)).toBe("0");
  });

  test("handles null/undefined", () => {
    expect(formatScore(null)).toBe("0");
    expect(formatScore(undefined)).toBe("0");
  });
});

// ─── timeAgo ─────────────────────────────────────────────────────────────────
describe("timeAgo", () => {
  test("returns 'just now' for very recent timestamps", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });

  test("returns minutes ago", () => {
    const ts = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    expect(timeAgo(ts)).toBe("15m ago");
  });

  test("returns hours ago", () => {
    const ts = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(ts)).toBe("3h ago");
  });

  test("returns days ago", () => {
    const ts = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(timeAgo(ts)).toBe("2d ago");
  });

  test("returns empty string for null/undefined", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
  });

  test("returns empty string for invalid date", () => {
    expect(timeAgo("not-a-date")).toBe("");
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────
describe("truncate", () => {
  test("does not truncate strings shorter than maxLen", () => {
    expect(truncate("Hello", 120)).toBe("Hello");
  });

  test("truncates and appends ellipsis at maxLen", () => {
    const long = "A".repeat(200);
    const result = truncate(long, 120);
    expect(result.length).toBe(121); // 120 chars + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  test("uses default maxLen of 120", () => {
    const long = "B".repeat(200);
    const result = truncate(long);
    expect(result.length).toBe(121);
  });

  test("returns empty string for null/undefined", () => {
    expect(truncate(null)).toBe("");
    expect(truncate(undefined)).toBe("");
  });

  test("returns empty string for non-string input", () => {
    expect(truncate(12345)).toBe("");
  });
});

// ─── isValidThumbnail ─────────────────────────────────────────────────────────
describe("isValidThumbnail", () => {
  test("returns true for https URLs", () => {
    expect(isValidThumbnail("https://img.youtube.com/vi/abc/hq.jpg")).toBe(true);
  });

  test("returns true for http URLs", () => {
    expect(isValidThumbnail("http://example.com/image.png")).toBe(true);
  });

  test("returns false for non-http placeholder strings", () => {
    expect(isValidThumbnail("self")).toBe(false);
    expect(isValidThumbnail("default")).toBe(false);
    expect(isValidThumbnail("nsfw")).toBe(false);
  });

  test("returns false for null/undefined/empty", () => {
    expect(isValidThumbnail(null)).toBe(false);
    expect(isValidThumbnail(undefined)).toBe(false);
    expect(isValidThumbnail("")).toBe(false);
  });

  test("returns false for non-string input", () => {
    expect(isValidThumbnail(123)).toBe(false);
  });
});

// ─── formatCountdown ─────────────────────────────────────────────────────────
describe("formatCountdown", () => {
  test("formats 90 seconds as 1m 30s", () => {
    expect(formatCountdown(90)).toBe("1m 30s");
  });

  test("pads seconds with leading zero", () => {
    expect(formatCountdown(65)).toBe("1m 05s");
  });

  test("formats 0 seconds", () => {
    expect(formatCountdown(0)).toBe("0m 00s");
  });

  test("handles null/undefined/negative", () => {
    expect(formatCountdown(null)).toBe("0m 00s");
    expect(formatCountdown(-10)).toBe("0m 00s");
  });

  test("formats large values", () => {
    expect(formatCountdown(1800)).toBe("30m 00s");
  });
});
