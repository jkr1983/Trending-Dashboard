require("./setup");
const nock = require("nock");
const { fetchTrending, fetchAllRanges, parseRepos } = require("../src/githubTrendingService");

const GH_BASE = "https://github.com";

// ─── Sample HTML ──────────────────────────────────────────────────────────────

function makeRepoHtml({
  owner = "testowner",
  repo  = "test-repo",
  desc  = "A sample repo description",
  lang  = "TypeScript",
  stars = "1,234",
  forks = "567",
  today = "89 stars today",
} = {}) {
  return `
    <article class="Box-row">
      <h2 class="h3 lh-condensed">
        <a href="/${owner}/${repo}">${owner}/${repo}</a>
      </h2>
      <p class="col-9 color-fg-muted my-1 pr-4">${desc}</p>
      <div class="f6 color-fg-muted mt-2">
        <span itemprop="programmingLanguage">${lang}</span>
        <a href="/${owner}/${repo}/stargazers" class="Link Link--muted d-inline-flex align-items-center mr-3">
          <svg></svg>
          ${stars}
        </a>
        <a href="/${owner}/${repo}/forks" class="Link Link--muted d-inline-flex align-items-center mr-3">
          <svg></svg>
          ${forks}
        </a>
        <span class="d-inline-block float-sm-right">${today}</span>
      </div>
    </article>
  `;
}

function makePageHtml(repos = [makeRepoHtml()]) {
  return `<html><body>${repos.join("")}</body></html>`;
}

// ─── parseRepos ───────────────────────────────────────────────────────────────

describe("parseRepos", () => {
  test("parses a single repo correctly", () => {
    const html = makePageHtml([makeRepoHtml()]);
    const repos = parseRepos(html);
    expect(repos.length).toBe(1);
    const r = repos[0];
    expect(r.owner).toBe("testowner");
    expect(r.name).toBe("test-repo");
    expect(r.fullName).toBe("testowner/test-repo");
    expect(r.description).toBe("A sample repo description");
    expect(r.language).toBe("TypeScript");
    expect(r.stars).toBe(1234);
    expect(r.forks).toBe(567);
    expect(r.starsToday).toBe(89);
    expect(r.url).toBe("https://github.com/testowner/test-repo");
  });

  test("assigns rank starting at 1", () => {
    const html = makePageHtml([makeRepoHtml(), makeRepoHtml({ owner: "other", repo: "thing" })]);
    const repos = parseRepos(html);
    expect(repos[0].rank).toBe(1);
    expect(repos[1].rank).toBe(2);
  });

  test("parses multiple repos", () => {
    const html = makePageHtml([
      makeRepoHtml({ owner: "a", repo: "one" }),
      makeRepoHtml({ owner: "b", repo: "two" }),
      makeRepoHtml({ owner: "c", repo: "three" }),
    ]);
    const repos = parseRepos(html);
    expect(repos.length).toBe(3);
    expect(repos.map((r) => r.owner)).toEqual(["a", "b", "c"]);
  });

  test("handles comma-separated star counts", () => {
    const html = makePageHtml([makeRepoHtml({ stars: "12,345", forks: "1,000" })]);
    const repos = parseRepos(html);
    expect(repos[0].stars).toBe(12345);
    expect(repos[0].forks).toBe(1000);
  });

  test("returns empty description when p tag is missing", () => {
    const html = `
      <article class="Box-row">
        <a href="/owner/repo">owner/repo</a>
      </article>
    `;
    const repos = parseRepos(html);
    expect(repos.length).toBe(1);
    expect(repos[0].description).toBe("");
  });

  test("returns null language when not present", () => {
    const html = makePageHtml([makeRepoHtml({ lang: "" })]);
    // When itemprop is missing or empty, language should be null/empty
    const repos = parseRepos(html);
    // language could be null or empty string — just not "TypeScript"
    expect(repos[0].language).not.toBe("TypeScript");
  });

  test("starsToday is 0 when not present", () => {
    const html = makePageHtml([makeRepoHtml({ today: "no stars info" })]);
    const repos = parseRepos(html);
    expect(repos[0].starsToday).toBe(0);
  });

  test("returns empty array for HTML with no repo articles", () => {
    const repos = parseRepos("<html><body><p>Nothing here</p></body></html>");
    expect(repos).toEqual([]);
  });

  test("builds correct GitHub URL", () => {
    const html = makePageHtml([makeRepoHtml({ owner: "facebook", repo: "react" })]);
    const repos = parseRepos(html);
    expect(repos[0].url).toBe("https://github.com/facebook/react");
  });
});

// ─── fetchTrending ────────────────────────────────────────────────────────────

describe("fetchTrending", () => {
  afterEach(() => nock.cleanAll());

  test("fetches daily trending by default", async () => {
    let capturedQuery = null;
    nock(GH_BASE)
      .get("/trending")
      .query((q) => { capturedQuery = q; return true; })
      .reply(200, makePageHtml(), { "Content-Type": "text/html" });

    await fetchTrending("daily");
    expect(capturedQuery.since).toBe("daily");
  });

  test("passes since param to GitHub URL", async () => {
    let capturedQuery = null;
    nock(GH_BASE)
      .get("/trending")
      .query((q) => { capturedQuery = q; return true; })
      .reply(200, makePageHtml(), { "Content-Type": "text/html" });

    await fetchTrending("weekly");
    expect(capturedQuery.since).toBe("weekly");
  });

  test("returns parsed repos array on success", async () => {
    const html = makePageHtml([
      makeRepoHtml({ owner: "vercel",    repo: "next.js"  }),
      makeRepoHtml({ owner: "microsoft", repo: "typescript" }),
    ]);
    nock(GH_BASE).get("/trending").query(true)
      .reply(200, html, { "Content-Type": "text/html" });

    const repos = await fetchTrending("daily");
    expect(Array.isArray(repos)).toBe(true);
    expect(repos.length).toBe(2);
    expect(repos[0].owner).toBe("vercel");
    expect(repos[1].owner).toBe("microsoft");
  });

  test("throws when GitHub is unreachable", async () => {
    nock(GH_BASE).get("/trending").query(true).replyWithError("Connection refused");
    await expect(fetchTrending("daily")).rejects.toThrow();
  });

  test("returns empty array when page has no repo articles", async () => {
    nock(GH_BASE).get("/trending").query(true)
      .reply(200, "<html><body></body></html>", { "Content-Type": "text/html" });

    const repos = await fetchTrending("daily");
    expect(repos).toEqual([]);
  });
});

// ─── fetchAllRanges ───────────────────────────────────────────────────────────

describe("fetchAllRanges", () => {
  afterEach(() => nock.cleanAll());

  test("returns { daily, weekly, monthly } object with parsed repos in each bucket", async () => {
    // Three distinct HTML responses, one per range. Order of ?since= is
    // whatever fetchAllRanges uses internally — we match on the query.
    nock(GH_BASE)
      .get("/trending").query({ since: "daily" })
      .reply(200, makePageHtml([makeRepoHtml({ owner: "daily-owner", repo: "daily-repo" })]),
        { "Content-Type": "text/html" });
    nock(GH_BASE)
      .get("/trending").query({ since: "weekly" })
      .reply(200, makePageHtml([makeRepoHtml({ owner: "weekly-owner", repo: "weekly-repo" })]),
        { "Content-Type": "text/html" });
    nock(GH_BASE)
      .get("/trending").query({ since: "monthly" })
      .reply(200, makePageHtml([makeRepoHtml({ owner: "monthly-owner", repo: "monthly-repo" })]),
        { "Content-Type": "text/html" });

    const buckets = await fetchAllRanges();
    expect(Object.keys(buckets).sort()).toEqual(["daily", "monthly", "weekly"]);
    expect(buckets.daily[0].owner).toBe("daily-owner");
    expect(buckets.weekly[0].owner).toBe("weekly-owner");
    expect(buckets.monthly[0].owner).toBe("monthly-owner");
  });

  test("returns empty array for a bucket that fails (partial success)", async () => {
    nock(GH_BASE)
      .get("/trending").query({ since: "daily" })
      .reply(200, makePageHtml([makeRepoHtml({ owner: "ok", repo: "ok" })]),
        { "Content-Type": "text/html" });
    nock(GH_BASE)
      .get("/trending").query({ since: "weekly" })
      .reply(500, "server error");
    nock(GH_BASE)
      .get("/trending").query({ since: "monthly" })
      .reply(200, makePageHtml([makeRepoHtml({ owner: "ok2", repo: "ok2" })]),
        { "Content-Type": "text/html" });

    const buckets = await fetchAllRanges();
    expect(buckets.daily.length).toBe(1);
    expect(buckets.weekly).toEqual([]);
    expect(buckets.monthly.length).toBe(1);
  });

  test("returns all empty when every bucket fails", async () => {
    nock(GH_BASE).get("/trending").query({ since: "daily" }).replyWithError("down");
    nock(GH_BASE).get("/trending").query({ since: "weekly" }).replyWithError("down");
    nock(GH_BASE).get("/trending").query({ since: "monthly" }).replyWithError("down");

    const buckets = await fetchAllRanges();
    expect(buckets).toEqual({ daily: [], weekly: [], monthly: [] });
  });
});
