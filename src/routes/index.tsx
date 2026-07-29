import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Calendar as CalendarIcon,
  CalendarRange,
  Download,
  List,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyRow, RowsPending } from "@/components/company-row";
import { ResultsCalendar } from "@/components/results-calendar";
import { calendarQueryOptions } from "@/lib/market-queries";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  addDaysIso,
  bucketFor,
  formatDayLabel,
  relativeTime,
  todayIso,
} from "@/lib/calendar-utils";
import type { Bucket } from "@/lib/calendar-utils";
import type { ResultEvent } from "@/lib/bse.server";

const VIEWS = [
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
] as const;

const WINDOWS = [
  { days: 7, label: "7D" },
  { days: 14, label: "14D" },
  { days: 30, label: "30D" },
] as const;

type View = (typeof VIEWS)[number]["id"];
type Search = { q: string; days: number; view: View };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search.q === "string" ? search.q.slice(0, 60) : "",
    days: WINDOWS.some((w) => w.days === Number(search.days)) ? Number(search.days) : 14,
    view: VIEWS.some((v) => v.id === search.view) ? (search.view as View) : "calendar",
  }),
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: ({ context, deps }) => {
    const from = todayIso();
    context.queryClient.ensureQueryData(
      calendarQueryOptions({ from, to: addDaysIso(from, deps.days) }),
    );
  },
  head: () => ({
    meta: [
      { title: "Results Radar — BSE earnings calendar & news" },
      {
        name: "description",
        content:
          "Track when BSE-listed companies report results, and read the quarterly forecast and earnings headlines for each one.",
      },
      { property: "og:title", content: "Results Radar — BSE earnings calendar & news" },
      {
        property: "og:description",
        content:
          "Upcoming BSE result dates with per-company forecast and earnings news, cached in your browser.",
      },
    ],
  }),
  component: ResultsRadar,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md px-4 py-24 text-center" role="alert">
      <h1 className="text-lg font-semibold">Calendar unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-4 py-24 text-center text-sm text-muted-foreground">Nothing scheduled.</div>
  ),
});

function ResultsRadar() {
  const { q, days, view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const from = todayIso();
  const range = useMemo(() => ({ from, to: addDaysIso(from, days) }), [from, days]);
  const options = calendarQueryOptions(range);
  const { data, isPending, isFetching, refetch } = useQuery(options);

  // SSR renders before any fetch state exists; only reflect it after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const busy = hydrated && isFetching;

  const events = data?.events ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return events;
    return events.filter(
      (e) =>
        e.company.toLowerCase().includes(needle) ||
        e.symbol.toLowerCase().includes(needle) ||
        e.scripCode.includes(needle),
    );
  }, [events, q]);

  const grouped = useMemo(() => {
    const map = new Map<Bucket, Map<string, ResultEvent[]>>();
    for (const event of filtered) {
      const bucket = bucketFor(event.date, from);
      const byDate = map.get(bucket) ?? new Map<string, ResultEvent[]>();
      byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
      map.set(bucket, byDate);
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((bucket) => ({
      bucket,
      days: [...map.get(bucket)!.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }));
  }, [filtered, from]);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ range, events }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bse-results-${range.from}-to-${range.to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                <Activity className="size-3.5" /> BSE forthcoming results
              </p>
              <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">Results Radar</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportJson}
                disabled={events.length === 0}
                className="font-mono text-[11px] uppercase tracking-widest"
              >
                <Download className="size-3.5" /> Export
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["company-news"] });
                  refetch();
                }}
                disabled={busy}
                className="font-mono text-[11px] uppercase tracking-widest"
              >
                <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} /> Refresh
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) =>
                  navigate({
                    search: (prev: Search) => ({ ...prev, q: e.target.value }),
                    replace: true,
                  })
                }
                placeholder="Filter by company, symbol or scrip code"
                className="h-9 pl-9 font-mono text-sm"
              />
            </div>
            <div className="inline-flex rounded-md border border-border p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  type="button"
                  onClick={() => navigate({ search: (prev: Search) => ({ ...prev, days: w.days }) })}
                  className={
                    days === w.days
                      ? "rounded bg-primary px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary-foreground"
                      : "rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  }
                >
                  {w.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-border p-0.5">
              {VIEWS.map((v) => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => navigate({ search: (prev: Search) => ({ ...prev, view: v.id }) })}
                    className={
                      view === v.id
                        ? "rounded bg-secondary px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-secondary-foreground"
                        : "rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    }
                    title={v.label}
                  >
                    <Icon className="size-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="tabular">{filtered.length} companies</span>
            <span className="flex items-center gap-1">
              <CalendarRange className="size-3" /> next {days} days
            </span>
            {data?.fetchedAt && <span>synced {relativeTime(data.fetchedAt)}</span>}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-20">
        {data?.error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              BSE lookup failed: {data.error}. Showing whatever is cached on this device — hit
              Refresh to retry.
            </span>
          </div>
        )}

        {isPending && <RowsPending />}

        {!isPending && filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">
              {q ? `No companies matching “${q}”.` : "No results scheduled in this window."}
            </p>
          </div>
        )}

        {!isPending && view === "list" && (
          <ResultsList grouped={grouped} />
        )}

        {!isPending && view === "calendar" && (
          <ResultsCalendar events={filtered} range={range} />
        )}

        <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Calendar from bseindia.com · headlines from Google News · cached in your browser only
        </p>
      </main>
    </div>
  );
}

function ResultsList({
  grouped,
}: {
  grouped: { bucket: Bucket; days: [string, ResultEvent[]][] }[];
}) {
  return (
    <>
      {grouped.map(({ bucket, days: dayGroups }) => (
        <section key={bucket} className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            {BUCKET_LABELS[bucket]}
          </h2>
          {dayGroups.map(([date, rows]) => (
            <div
              key={date}
              className="mt-3 overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex items-center justify-between border-b border-grid bg-secondary/40 px-3 py-2 sm:px-4">
                <span className="font-mono text-xs tracking-widest text-foreground">
                  {formatDayLabel(date)}
                </span>
                <span className="font-mono text-[11px] tabular text-muted-foreground">
                  {rows.length}
                </span>
              </div>
              {rows.map((event) => (
                <CompanyRow key={`${event.scripCode}-${event.date}`} event={event} />
              ))}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
