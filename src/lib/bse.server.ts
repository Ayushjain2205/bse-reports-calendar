/**
 * Server-only helpers for the BSE forthcoming-results calendar.
 *
 * BSE's public JSON endpoint is what their own Angular app calls. It rejects
 * requests without browser-like headers, so we always send a full set.
 */

const BSE_API = "https://api.bseindia.com/BseIndiaAPI/api/Corpforthresults/w";

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.bseindia.com/",
  Origin: "https://www.bseindia.com",
};

export type ResultEvent = {
  scripCode: string;
  symbol: string;
  company: string;
  /** ISO date, yyyy-mm-dd */
  date: string;
  purpose: string;
  bseUrl: string;
};

type BseRow = {
  scrip_Code?: string;
  short_name?: string;
  Long_Name?: string;
  meeting_date?: string;
  URL?: string;
  Purpose?: string;
};

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** "29 Jul 2026" -> "2026-07-29". Returns "" when unparseable. */
export function parseBseDate(raw: string | undefined): string {
  if (!raw) return "";
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return "";
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return "";
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

/** yyyy-mm-dd -> yyyymmdd (BSE's filter format). */
export function toBseParam(iso: string | undefined): string {
  return iso ? iso.replace(/-/g, "") : "";
}

export function normalizeRows(rows: BseRow[]): ResultEvent[] {
  const seen = new Set<string>();
  const out: ResultEvent[] = [];

  for (const row of rows) {
    const date = parseBseDate(row.meeting_date);
    const company = (row.Long_Name ?? "").trim();
    if (!date || !company) continue;

    const scripCode = (row.scrip_Code ?? "").trim();
    const key = `${scripCode}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      scripCode,
      symbol: (row.short_name ?? "").trim(),
      company,
      date,
      purpose: (row.Purpose ?? "").trim() || "Results",
      bseUrl: (row.URL ?? "").trim(),
    });
  }

  out.sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company));
  return out;
}

export async function fetchBseCalendar(input: {
  from?: string;
  to?: string;
  scripCode?: string;
}): Promise<ResultEvent[]> {
  const params = new URLSearchParams({
    fromdate: toBseParam(input.from),
    scripcode: input.scripCode ?? "",
    todate: toBseParam(input.to),
  });

  const res = await fetch(`${BSE_API}?${params.toString()}`, {
    headers: BROWSER_HEADERS,
  });

  if (!res.ok) {
    throw new Error(`BSE responded with ${res.status}`);
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // BSE serves an HTML block page when it throttles a caller.
    throw new Error("BSE returned an unexpected response (likely rate limited)");
  }

  if (!Array.isArray(parsed)) return [];
  return normalizeRows(parsed as BseRow[]);
}
