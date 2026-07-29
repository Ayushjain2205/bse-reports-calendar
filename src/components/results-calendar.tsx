import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { CompanyRow } from "@/components/company-row";
import { addDaysIso, daysUntil, formatDayLabel, todayIso } from "@/lib/calendar-utils";
import type { ResultEvent } from "@/lib/bse.server";

function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function endOfRange(start: string, totalDays: number): string {
  return addDaysIso(start, totalDays - 1);
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekdayHeaders(): string[] {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

export function ResultsCalendar({
  events,
  range,
}: {
  events: ResultEvent[];
  range: { from: string; to: string };
}) {
  const totalDays = daysUntil(range.to, range.from) + 1;
  const [page, setPage] = useState(0);

  // Show 28-day windows so the grid stays meaningful even for 7D/14D ranges.
  const daysPerPage = 28;
  const pageStart = addDaysIso(range.from, page * daysPerPage);
  const pageEndRaw = addDaysIso(pageStart, daysPerPage - 1);
  const pageEnd = pageEndRaw > range.to ? range.to : pageEndRaw;
  const hasNext = pageEndRaw < range.to;
  const hasPrev = page > 0;

  const byDate = new Map<string, ResultEvent[]>();
  for (const e of events) {
    if (e.date >= pageStart && e.date <= pageEnd) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
  }

  const gridStart = startOfWeek(pageStart);
  const gridEnd = addDaysIso(startOfWeek(pageEnd), 6);
  const cells: string[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    cells.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedEvents = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <CalendarIcon className="size-4 text-primary" />
          {monthLabel(pageStart)}
          {pageStart.slice(0, 4) !== pageEnd.slice(0, 4) && (
            <span className="text-muted-foreground">– {monthLabel(pageEnd)}</span>
          )}
        </h2>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-secondary/40">
          {weekdayHeaders().map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 bg-background">
          {cells.map((date) => {
            const inRange = date >= pageStart && date <= pageEnd;
            const dayEvents = byDate.get(date) ?? [];
            const isToday = date === todayIso();
            const isSelected = selectedDate === date;
            const delta = daysUntil(date);

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : date)}
                disabled={!inRange}
                className={cn(
                  "relative flex min-h-[88px] flex-col items-start gap-1 border-b border-r border-border p-2 text-left transition-colors last:border-r-0",
                  !inRange && "bg-muted/20 text-muted-foreground/40",
                  inRange && "hover:bg-secondary/30",
                  isToday && "bg-primary/5",
                  isSelected && "bg-secondary/60 ring-1 ring-inset ring-primary/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] tabular",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                    !inRange && "text-muted-foreground/40",
                  )}
                >
                  {Number(date.slice(8, 10))}
                </span>

                {dayEvents.length > 0 && (
                  <>
                    <div className="flex w-full flex-wrap gap-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.scripCode}
                          className={cn(
                            "block max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[10px] tabular",
                            delta === 0
                              ? "bg-primary/15 text-primary"
                              : delta < 0
                                ? "bg-accent/10 text-accent"
                                : "bg-secondary text-secondary-foreground",
                          )}
                          title={e.company}
                        >
                          {e.symbol || e.scripCode}
                        </span>
                      ))}
                    </div>
                    {dayEvents.length > 3 && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedEvents.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-grid bg-secondary/40 px-3 py-2 sm:px-4">
            <span className="font-mono text-xs tracking-widest text-foreground">
              {formatDayLabel(selectedDate!)}
            </span>
            <span className="font-mono text-[11px] tabular text-muted-foreground">
              {selectedEvents.length} result{selectedEvents.length === 1 ? "" : "s"}
            </span>
          </div>
          {selectedEvents.map((event) => (
            <CompanyRow key={`${event.scripCode}-${event.date}`} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
