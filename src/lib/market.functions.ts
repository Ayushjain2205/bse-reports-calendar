import { createServerFn } from "@tanstack/react-start";

import { fetchBseCalendar } from "./bse.server";
import { buildNewsQueries, fetchGoogleNews, isRelevant, resolveNewsItems } from "./news.server";
import { calendarInput, newsInput } from "./market-schemas";
import type { ResultEvent } from "./bse.server";
import type { NewsItem } from "./news.server";

export type CalendarResponse = {
  events: ResultEvent[];
  fetchedAt: string;
  error: string | null;
};

export type NewsResponse = {
  items: NewsItem[];
  query: string;
  fetchedAt: string;
  error: string | null;
};

export const getResultsCalendar = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => calendarInput.parse(data ?? {}))
  .handler(async ({ data }): Promise<CalendarResponse> => {
    try {
      const events = await fetchBseCalendar(data);
      return { events, fetchedAt: new Date().toISOString(), error: null };
    } catch (error) {
      console.error("getResultsCalendar failed", error);
      return {
        events: [],
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Could not reach BSE",
      };
    }
  });

export const getCompanyNews = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => newsInput.parse(data))
  .handler(async ({ data }): Promise<NewsResponse> => {
    const queries = buildNewsQueries(data.company, data.resultDate);
    let usedQuery = queries[0];
    try {
      for (const query of queries) {
        usedQuery = query;
        const raw = await fetchGoogleNews(query, 60);
        const relevant = raw.filter((item) => isRelevant(item.headline, data.company));
        if (relevant.length === 0) continue;
        return {
          items: await resolveNewsItems(relevant.slice(0, 10)),
          query,
          fetchedAt: new Date().toISOString(),
          error: null,
        };
      }
      return { items: [], query: usedQuery, fetchedAt: new Date().toISOString(), error: null };
    } catch (error) {
      console.error("getCompanyNews failed", error);
      return {
        items: [],
        query: usedQuery,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Could not reach Google News",
      };
    }
  });

