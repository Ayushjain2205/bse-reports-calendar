/**
 * Server-only helpers for Google News RSS lookups.
 *
 * No API key: the RSS search endpoint is public. We keep the request volume low
 * by fetching only when a company row is expanded and caching in the browser.
 */

export type NewsItem = {
  headline: string;
  publisher: string;
  publishedAt: string | null;
  url: string;
};



const NOISE =
  /\b(ltd|limited|ltd\.|the|and|co|company|corp|corporation|india|indian|pvt|private|plc|inc)\b/gi;

/** Strip corporate boilerplate so the search query matches how press writes it. */
export function cleanCompanyName(raw: string): string {
  const cleaned = raw
    .replace(/[.,]/g, " ")
    .replace(/&/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If cleaning nuked everything meaningful, fall back to the original.
  return cleaned.length >= 3 ? cleaned : raw.trim();
}

/**
 * Indian fiscal quarters: Apr-Jun = Q1 ... Jan-Mar = Q4.
 *
 * A board meets in the month AFTER the quarter closes, so a 29 Jul 2026 result
 * date reports Q1 FY27 — we step back one month before bucketing.
 */
export function fiscalQuarter(iso: string): { quarter: number; fyLabel: string } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  let year = Number(m[1]);
  let month = Number(m[2]) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const quarter = Math.floor(((month - 4 + 12) % 12) / 3) + 1;
  // FY ends in March: Jan-Mar belongs to the FY that started the previous year.
  const fyEndYear = month >= 4 ? year + 1 : year;

  return { quarter, fyLabel: `FY${String(fyEndYear % 100).padStart(2, "0")}` };
}


export function buildNewsQuery(company: string, resultDate: string): string {
  return buildNewsQueries(company, resultDate)[0];
}

/**
 * Tiered queries, strictest first. Google News AND-joins every term, so a
 * strict multi-word query often returns nothing for mid-caps — we widen
 * step by step and stop at the first tier with relevant hits.
 */
export function buildNewsQueries(company: string, resultDate: string): string[] {
  const name = cleanCompanyName(company);
  const fq = fiscalQuarter(resultDate);
  const period = fq ? `Q${fq.quarter} ${fq.fyLabel}` : "quarterly";

  return [
    `"${name}" ${period} results profit`,
    `"${name}" quarterly results profit`,
    `"${name}" results`,
    `"${name}"`,
  ];
}


/**
 * Google News ignores quoting often enough that we re-check relevance locally:
 * a headline must mention a distinctive token of the company name.
 */
export function isRelevant(headline: string, company: string): boolean {
  const tokens = cleanCompanyName(company)
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return true;
  const lower = headline.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}


function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

/** Minimal RSS parse — no XML dependency, safe on the Worker runtime. */
export function parseNewsFeed(xml: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  for (const block of blocks) {
    const rawTitle = tag(block, "title");
    const url = tag(block, "link");
    if (!rawTitle || !url) continue;

    const sourceTag = tag(block, "source");
    // Google News appends " - Publisher" to the headline.
    const split = rawTitle.lastIndexOf(" - ");
    const publisher = sourceTag || (split > 0 ? rawTitle.slice(split + 3) : "Google News");
    const headline = sourceTag || split <= 0 ? rawTitle : rawTitle.slice(0, split);

    const pubDate = tag(block, "pubDate");
    const parsedDate = pubDate ? new Date(pubDate) : null;

    items.push({
      headline: headline.trim(),
      publisher: publisher.trim(),
      publishedAt:
        parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
      url,
    });

    if (items.length >= limit) break;
  }

  return items;
}

export async function fetchGoogleNews(query: string, limit = 10): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`Google News responded with ${res.status}`);
  }

  return parseNewsFeed(await res.text(), limit);
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Google News RSS links point at news.google.com, which refuses to be opened
 * inside an embedded/preview context (ERR_BLOCKED_BY_RESPONSE). Google exposes
 * the real publisher URL through its internal batchexecute endpoint: the
 * article page embeds a signed payload in `c-wiz[data-p]` which we replay.
 */
export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!/^https?:\/\/news\.google\.com\//.test(url)) return url;

  try {
    const page = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
    if (!page.ok) return url;
    const html = await page.text();

    const match = html.match(/c-wiz[^>]*data-p="([^"]+)"/);
    if (!match) return url;

    const payload = JSON.parse(decodeEntities(match[1]).replace("%.@.", '["garturlreq",'));
    // Drop the trailing signature block Google adds for the page render.
    const args = [...payload.slice(0, -6), ...payload.slice(-2)];
    const body = new URLSearchParams({
      "f.req": JSON.stringify([[["Fbv4je", JSON.stringify(args), null, "generic"]]]),
    });

    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: {
        "User-Agent": BROWSER_UA,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    });
    if (!res.ok) return url;

    const text = await res.text();
    const chunk = text.split("\n\n")[1];
    if (!chunk) return url;
    const resolved = JSON.parse(JSON.parse(chunk)[0][2])[1];

    return typeof resolved === "string" && /^https?:\/\//.test(resolved) ? resolved : url;
  } catch (error) {
    console.error("resolveGoogleNewsUrl failed", error);
    return url;
  }
}

/** Resolve a batch of RSS items, keeping the original link when decoding fails. */
export async function resolveNewsItems(items: NewsItem[]): Promise<NewsItem[]> {
  return Promise.all(
    items.map(async (item) => ({ ...item, url: await resolveGoogleNewsUrl(item.url) })),
  );
}
