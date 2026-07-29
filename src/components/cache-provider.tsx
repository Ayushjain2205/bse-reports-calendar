import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";

/**
 * Persists the query cache to localStorage so the results calendar and fetched
 * headlines survive reloads. This is the app's only storage layer — there is no
 * database, so nothing leaves the device.
 */
export function CacheProvider({ client, children }: { client: QueryClient; children: ReactNode }) {
  // localStorage only exists in the browser; during SSR we use the plain provider.
  const persister = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createSyncStoragePersister({
      storage: window.localStorage,
      key: "bse-results-tracker-cache",
      throttleTime: 1000,
    });
  }, []);

  if (!persister) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
