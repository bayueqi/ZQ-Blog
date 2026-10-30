import { orpc } from "@/lib/orpc";

export const searchMetaQuery = orpc.search.version.queryOptions();

export const searchDocsQueryOptions = (
  query: string,
  version: string,
  isAdmin: boolean,
) => {
  const options = orpc.search.search.queryOptions({
    input: { q: query, v: version },
  });
  // 管理员与访客看到的结果不同，缓存要分开。
  return { ...options, queryKey: [...options.queryKey, isAdmin] };
};
