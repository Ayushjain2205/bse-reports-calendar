import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Loader2, Newspaper, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { newsQueryOptions } from "@/lib/market-queries";
import { daysUntil, relativeTime } from "@/lib/calendar-utils";
import type { ResultEvent } from "@/lib/bse.server";

function NewsList({
  company,
  resultDate,
}: {
  company: string;
  resultDate: string;
}) {
  const { data, isPending, isError, refetch } = useQuery(
    newsQueryOptions({ company, resultDate }),
  );

  if (isPending) {
    return (
      <div className="space-y-2 pt-1">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (isError || data?.error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
        <span className="flex items-center gap-2">
          <TriangleAlert className="size-3.5" />
          {data?.error ?? "News lookup failed"}
        </span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        No headlines yet for this quarter. Try the other tab.
      </p>
    );
  }

  return (
    <>
      <p className="pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
        search: {data.query}
      </p>
      <ul className="divide-y divide-border/60">

      {data.items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="group flex items-start gap-3 py-2.5 transition-colors hover:bg-secondary/50"
          >
            <Newspaper className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug text-foreground group-hover:text-primary">
                {item.headline}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{item.publisher}</span>
                {item.publishedAt && <span>· {relativeTime(item.publishedAt)}</span>}
              </span>
            </span>
            <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </a>

        </li>
      ))}
      </ul>
    </>
  );
}


export function CompanyRow({ event }: { event: ResultEvent }) {
  const delta = daysUntil(event.date);
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-grid last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/40 sm:px-4"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground sm:text-base">
            {event.company}
          </span>
          <span className="mt-0.5 flex items-center gap-2 font-mono text-[11px] tracking-wide text-muted-foreground">
            <span className="tabular">{event.scripCode}</span>
            {event.symbol && <span className="text-primary/80">{event.symbol}</span>}
          </span>
        </span>
        <Badge
          variant="outline"
          className="hidden shrink-0 border-border/70 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline-flex"
        >
          {event.purpose}
        </Badge>
        <span
          className={cn(
            "shrink-0 rounded border px-2 py-1 font-mono text-[11px] tabular",
            delta === 0 && "border-primary/50 bg-primary/15 text-primary",
            delta > 0 && "border-border/70 text-muted-foreground",
            delta < 0 && "border-accent/40 text-accent",
          )}
        >
          {delta === 0 ? "TODAY" : delta > 0 ? `T-${delta}` : `T+${Math.abs(delta)}`}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-grid bg-background/40 px-3 pb-3 pt-2 sm:px-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Latest headlines
            </span>

            {event.bseUrl && (
              <a
                href={event.bseUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary"
              >
                BSE page <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <NewsList company={event.company} resultDate={event.date} />
        </div>
      )}
    </div>
  );
}

export function RowsPending() {
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading calendar…
    </div>
  );
}
