import { queryOptions } from "@tanstack/react-query";

import { getCompanyNews, getResultsCalendar } from "./market.functions";

export const CALENDAR_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours
export const NEWS_STALE_MS = 30 * 60 * 1000; // 30 minutes

export function calendarQueryOptions(range: { from: string; to: string }) {
  return queryOptions({
    queryKey: ["bse-calendar", range.from, range.to] as const,
    queryFn: () => getResultsCalendar({ data: range }),
    staleTime: CALENDAR_STALE_MS,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export function newsQueryOptions(input: { company: string; resultDate: string }) {
  return queryOptions({
    // v4: single news feed, no forecast/reported tabs.
    queryKey: ["company-news", "v4", input.company, input.resultDate] as const,

    queryFn: () => getCompanyNews({ data: input }),
    staleTime: NEWS_STALE_MS,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
