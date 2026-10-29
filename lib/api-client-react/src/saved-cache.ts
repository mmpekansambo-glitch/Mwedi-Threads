import type { QueryClient, QueryKey } from "@tanstack/react-query";

// Puts what the server just saved straight into the cached item and lists,
// so the page a maker goes back to already shows their change. The lists
// then refetch in the background to pick up anything else.
export function showSaved<T extends { id: string }>(
  client: QueryClient,
  keys: { list: QueryKey; item: QueryKey },
  saved: T,
) {
  client.setQueryData(keys.item, saved);
  for (const [key, list] of client.getQueriesData<T[]>({ queryKey: keys.list })) {
    if (!Array.isArray(list)) continue;
    const known = list.some((item) => item.id === saved.id);
    // A new item only goes straight into the unfiltered list; filtered
    // lists wait for the refetch to decide whether it belongs.
    const filtered = key.slice(1).some((part) => part && typeof part === "object" && Object.keys(part).length > 0);
    if (!known && filtered) continue;
    client.setQueryData<T[]>(key, known ? list.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...list]);
  }
  void client.invalidateQueries({ queryKey: keys.list });
}

// Takes a removed item out of the cached lists straight away.
export function showRemoved(client: QueryClient, listKey: QueryKey, id: string) {
  for (const [key, list] of client.getQueriesData<{ id: string }[]>({ queryKey: listKey })) {
    if (Array.isArray(list)) client.setQueryData(key, list.filter((item) => item.id !== id));
  }
  void client.invalidateQueries({ queryKey: listKey });
}

// Refetches every cached query whose URL starts with one of the prefixes,
// e.g. "/api/projects" for the project list and each project page.
export function refreshPaths(client: QueryClient, ...prefixes: string[]) {
  void client.invalidateQueries({
    predicate: (query) => prefixes.some((prefix) => String(query.queryKey[0]).startsWith(prefix)),
  });
}
