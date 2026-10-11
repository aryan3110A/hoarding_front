import { QueryClient } from "@tanstack/react-query";

/** Inventory lists stay fresh for 2 minutes. Mutations invalidate them sooner. */
export const HOARDING_LIST_STALE_MS = 2 * 60 * 1000;

/** Cities, types, landmarks, and categories change less often than board status. */
export const HOARDING_LOOKUP_STALE_MS = 5 * 60 * 1000;

/** A single board can change after an edit, so keep its detail fresher than lookups. */
export const HOARDING_DETAIL_STALE_MS = 60 * 1000;

/** Availability is used near booking decisions, so it expires quickly. */
export const HOARDING_AVAILABILITY_STALE_MS = 15 * 1000;

/** Drop unused cache entries 15 minutes after they were last observed. */
export const QUERY_GC_MS = 15 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: HOARDING_LIST_STALE_MS,
      gcTime: QUERY_GC_MS,
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

export function actorScope() {
  if (typeof window === "undefined") return "server";
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return String(user?.id || user?.email || "anonymous");
  } catch {
    return "anonymous";
  }
}

export function normalizeQueryParams(params?: object | null) {
  const source = (params || {}) as Record<string, unknown>;
  const normalized: Record<string, string | number | boolean> = {};
  Object.keys(source)
    .sort()
    .forEach((key) => {
      const value = source[key];
      if (value == null) return;
      if (typeof value === "string" && value.trim() === "") return;
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        normalized[key] = value;
      }
    });
  return normalized;
}

export function scopedQueryKey(parts: readonly unknown[]) {
  return [...parts, actorScope()] as const;
}

export const HOARDING_CATALOG_LIMIT = 2000;

export function isUnfilteredHoardingQuery(
  params: Record<string, string | number | boolean>,
) {
  return Object.keys(params).every((key) => key === "page" || key === "limit");
}
export function isQueryFresh(queryKey: readonly unknown[], staleTime: number) {
  const state = queryClient.getQueryState(queryKey);
  if (!state || state.status !== "success" || state.data === undefined) return false;
  if (state.isInvalidated) return false;
  return Date.now() - state.dataUpdatedAt < staleTime;
}

export async function readThroughCache<T>(options: {
  queryKey: readonly unknown[];
  staleTime: number;
  queryFn: () => Promise<T>;
}) {
  return queryClient.fetchQuery({
    queryKey: options.queryKey,
    staleTime: options.staleTime,
    queryFn: options.queryFn,
  });
}

export function invalidateHoardingQueries() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["hoardings"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
}

export function invalidateResource(resource: string) {
  return queryClient.invalidateQueries({ queryKey: [resource] });
}

export function invalidateCategoryQueries() {
  return queryClient.invalidateQueries({ queryKey: ["categories"] });
}

export function clearQueryCache() {
  queryClient.clear();
}
