import { formatNum, formatScore, timeAgo, truncate, isValidThumbnail, formatCountdown } from "../../utils/formatters";

describe("formatNum", () => {
  test("formats millions", () => { expect(formatNum(1500000)).toBe("1.5M"); });
  test("formats thousands", () => { expect(formatNum(12500)).toBe("12.5K"); });
  test("returns raw string for small numbers", () => { expect(formatNum(999)).toBe("999"); });
  test("handles 0", () => { expect(formatNum(0)).toBe("0"); });
  test("handles null", () => { expect(formatNum(null)).toBe("0"); });
  test("handles undefined", () => { expect(formatNum(undefined)).toBe("0"); });
  test("handles NaN", () => { expect(formatNum(NaN)).toBe("0"); });
  test("formats exactly 1M", () => { expect(formatNum(1000000)).toBe("1.0M"); });
  test("formats exactly 1K", () => { expect(formatNum(1000)).toBe("1.0K"); });
});

describe("formatScore", () => {
  test("formats thousands with k", () => { expect(formatScore(1500)).toBe("1.5k"); });
  test("returns raw string under 1000", () => { expect(formatScore(999)).toBe("999"); });
  test("handles 0", () => { expect(formatScore(0)).toBe("0"); });
  test("handles null", () => { expect(formatScore(null)).toBe("0"); });
});

describe("timeAgo", () => {
  test("returns 'just now' for very recent", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });
  test("returns minutes ago", () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60000).toISOString())).toBe("5m ago");
  });
  test("returns hours ago", () => {
    expect(timeAgo(new Date(Date.now() - 3 * 3600000).toISOString())).toBe("3h ago");
  });
  test("returns days ago", () => {
    expect(timeAgo(new Date(Date.now() - 2 * 86400000).toISOString())).toBe("2d ago");
  });
  test("returns empty string for null", () => { expect(timeAgo(null)).toBe(""); });
  test("returns empty string for empty string", () => { expect(timeAgo("")).toBe(""); });
});

describe("truncate", () => {
  test("truncates long strings", () => {
    const result = truncate("A".repeat(200), 120);
    expect(result.length).toBe(121);
    expect(result).toMatch(/…$/);
  });
  test("does not truncate short strings", () => {
    expect(truncate("hello", 120)).toBe("hello");
  });
  test("handles null", () => { expect(truncate(null)).toBe(""); });
});

describe("isValidThumbnail", () => {
  test("returns true for https URL", () => {
    expect(isValidThumbnail("https://example.com/img.jpg")).toBe(true);
  });
  test("returns true for http URL", () => {
    expect(isValidThumbnail("http://example.com/img.jpg")).toBe(true);
  });
  test("returns false for null", () => { expect(isValidThumbnail(null)).toBe(false); });
  test("returns false for empty string", () => { expect(isValidThumbnail("")).toBe(false); });
  test("returns false for non-string", () => { expect(isValidThumbnail(123)).toBe(false); });
});

describe("formatCountdown", () => {
  test("formats 90 seconds as 1m 30s", () => { expect(formatCountdown(90)).toBe("1m 30s"); });
  test("pads seconds with leading zero", () => { expect(formatCountdown(65)).toBe("1m 05s"); });
  test("formats 0 seconds", () => { expect(formatCountdown(0)).toBe("0m 00s"); });
  test("handles null", () => { expect(formatCountdown(null)).toBe("0m 00s"); });
  test("handles negative", () => { expect(formatCountdown(-10)).toBe("0m 00s"); });
  test("formats 30 minutes", () => { expect(formatCountdown(1800)).toBe("30m 00s"); });
});
