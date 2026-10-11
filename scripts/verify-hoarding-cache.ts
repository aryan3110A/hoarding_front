import {
  HOARDING_LIST_STALE_MS,
  invalidateHoardingQueries,
  normalizeQueryParams,
  queryClient,
  readThroughCache,
  scopedQueryKey,
} from "../lib/query-client";

function assert(name: string, value: boolean) {
  if (!value) throw new Error(`FAIL ${name}`);
  console.log(`PASS ${name}`);
}

async function main() {
  queryClient.clear();
  let calls = 0;
  const key = scopedQueryKey(["hoardings", "list", normalizeQueryParams({ limit: 1000 })]);
  const load = () =>
    readThroughCache({
      queryKey: key,
      staleTime: HOARDING_LIST_STALE_MS,
      queryFn: async () => {
        calls += 1;
        return { success: true, data: { hoardings: [{ code: "SA1" }] } };
      },
    });

  const first = await load();
  const second = await load();
  assert("first request runs", calls === 1);
  assert("fresh repeat is cached", calls === 1 && second === first);

  const [a, b] = await Promise.all([load(), load()]);
  assert("in-flight duplicates share one request", calls === 1 && a === b);

  const filteredKey = scopedQueryKey([
    "hoardings",
    "list",
    normalizeQueryParams({ city: "Ahmedabad", limit: 50, page: 1, area: "" }),
  ]);
  await readThroughCache({
    queryKey: filteredKey,
    staleTime: HOARDING_LIST_STALE_MS,
    queryFn: async () => {
      calls += 1;
      return { success: true, data: { hoardings: [] } };
    },
  });
  assert("different filters use a different request", calls === 2);
  assert(
    "empty filters are ignored",
    JSON.stringify(normalizeQueryParams({ city: "Ahmedabad", area: "", page: 1 })) ===
      JSON.stringify({ city: "Ahmedabad", page: 1 }),
  );

  await invalidateHoardingQueries();
  await load();
  assert("invalidation fetches again", calls === 3);

  queryClient.setQueryDefaults(key as unknown as any, { staleTime: 1 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await queryClient.fetchQuery({
    queryKey: key,
    staleTime: 1,
    queryFn: async () => {
      calls += 1;
      return { success: true, data: { hoardings: [{ code: "SA2" }] } };
    },
  });
  assert("stale data is refreshed", calls === 4);

  queryClient.clear();
  await load();
  assert("cleared cache does not leak the previous result", calls === 5);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
