import { Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { Spinner } from "@/components/ui/spinner";
import { useContentMotion } from "@/hooks/use-motion";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchHit } from "@/features/search/search.schema";
import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import { m } from "@/paraglide/messages";
import "./search-page.css";

const KIND_LABELS: Record<SearchHit["kind"], () => string> = {
  post: m.search_kind_post,
  moment: m.search_kind_moment,
  gallery: m.search_kind_gallery,
  "friend-link": m.search_kind_friend,
};

/** 结果跳到各自页面：文章详情、日常列表的对应条目、相册集、前台友链页。 */
function ResultLink({
  hit,
  children,
  className = "public-search-result",
  ariaLabel,
}: {
  hit: SearchHit;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  if (hit.kind === "post") {
    return (
      <Link
        to="/post/$slug"
        params={{ slug: hit.slug ?? "" }}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }
  if (hit.kind === "gallery") {
    return (
      <Link
        to="/gallery/$category"
        params={{ category: hit.slug ?? "" }}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }
  if (hit.kind === "moment") {
    return (
      <Link
        to="/moments"
        hash={`moment-${hit.id}`}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link to="/friend-links" className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

/** 一行命中句子；文章可点进原文的对应位置，其余类型只是文字。 */
function SnippetLine({
  hit,
  line,
  children,
}: {
  hit: SearchHit;
  line: SearchHit["snippets"][number];
  children: ReactNode;
}) {
  if (hit.kind !== "post" || !hit.slug) {
    return <span className="public-search-line">{children}</span>;
  }
  return (
    <Link
      to="/post/$slug"
      params={{ slug: hit.slug }}
      search={{ hit: line.term, n: line.occurrence }}
      className="public-search-line"
    >
      {children}
    </Link>
  );
}

interface SearchPageProps {
  query: string;
  searchedQuery: string;
  results: SearchHit[];
  isSearching: boolean;
  hasError: boolean;
  onQueryChange: (query: string) => void;
  onCompositionChange: (composing: boolean) => void;
  onRetry: () => void;
}
export function SearchPage({
  query,
  searchedQuery,
  results,
  isSearching,
  hasError,
  onQueryChange,
  onCompositionChange,
  onRetry,
}: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const hasQuery = query.trim().length > 0;
  // 计数按关键词在各条结果里出现的次数累加，不是结果的条数。
  const occurrenceCount = results.reduce(
    (total, hit) => total + Math.max(hit.occurrences ?? 0, 1),
    0,
  );
  useEffect(() => {
    // Avoid opening the software keyboard automatically on touch devices.
    if (window.matchMedia("(pointer: fine)").matches)
      inputRef.current?.focus({ preventScroll: true });
  }, []);
  useContentMotion(
    resultsRef,
    !hasQuery
      ? "empty"
      : isSearching
        ? "loading"
        : hasError
          ? "error"
          : `${searchedQuery}:${results.map((result) => `${result.kind}-${result.id}`).join(",")}`,
  );
  return (
    <section className="public-search fuwari-card-base">
      <h1>{m.search_page_heading()}</h1>
      <SearchField
        ref={inputRef}
        size="lg"
        value={query}
        aria-label={m.search_placeholder()}
        placeholder={m.search_placeholder()}
        onValueChange={onQueryChange}
        onCompositionStart={() => onCompositionChange(true)}
        onCompositionEnd={() => onCompositionChange(false)}
        clearLabel={m.search_clear()}
      />
      {hasQuery ? (
        <p className="public-search-caption" role="status" aria-live="polite">
          {isSearching ? (
            <>
              <Spinner size={14} />
              {m.search_loading()}
            </>
          ) : hasError ? (
            m.search_failed()
          ) : (
            m.search_result_count({ count: occurrenceCount })
          )}
        </p>
      ) : null}
      <div ref={resultsRef} aria-busy={isSearching}>
        {!hasQuery ? (
          <EmptyState title={m.search_fuwari_intro_title()} />
        ) : hasError ? (
          <EmptyState
            description={m.search_retry_hint()}
            action={
              <Button size="lg" onClick={onRetry}>
                {m.search_retry()}
              </Button>
            }
          />
        ) : results.length ? (
          <ul className="public-search-results" data-updating={isSearching}>
            {results.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <div className="public-search-result">
                  <ResultLink hit={hit} className="public-search-heading">
                    <h2>
                      <Highlighted html={hit.titleHtml} fallback={hit.title} />
                    </h2>
                  </ResultLink>
                  {hit.snippets.length > 0 ? (
                    <div className="public-search-excerpts">
                      {hit.snippets.map((snippet, index) => (
                        <p className="public-search-excerpt" key={index}>
                          <SnippetLine hit={hit} line={snippet}>
                            <Highlighted html={snippet.html} fallback="" />
                          </SnippetLine>
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <div className="public-search-tags">
                    <Badge>{KIND_LABELS[hit.kind]()}</Badge>
                    {hit.category ? (
                      <Badge
                        tone={
                          textHits(hit.category, searchedQuery)
                            ? "primary"
                            : "neutral"
                        }
                      >
                        <QueryHighlight
                          text={hit.category}
                          query={searchedQuery}
                        />
                      </Badge>
                    ) : null}
                    {hit.tags.map((tag) => (
                      <Badge
                        key={tag}
                        tone={
                          textHits(tag, searchedQuery) ? "primary" : "neutral"
                        }
                      >
                        <QueryHighlight text={tag} query={searchedQuery} />
                      </Badge>
                    ))}
                    {hit.publishedAt ? (
                      <time
                        className="public-search-date"
                        dateTime={hit.publishedAt}
                      >
                        <QueryHighlight
                          text={formatPublicPostDate(hit.publishedAt)}
                          query={searchedQuery}
                        />
                      </time>
                    ) : null}
                  </div>
                  <ResultLink
                    hit={hit}
                    className="public-search-arrow"
                    ariaLabel={hit.title}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </ResultLink>
                </div>
              </li>
            ))}
          </ul>
        ) : isSearching ? (
          <div className="public-search-skeleton" aria-hidden="true">
            <Skeleton className="h-6 w-[65%] rounded-md" />
            <Skeleton className="h-4.5 rounded-md" />
            <Skeleton className="h-4.5 w-4/5 rounded-md" />
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={m.search_no_results()}
            description={
              <>
                <p>
                  {m.search_no_results_with_query({ query: searchedQuery })}
                </p>
                <p>{m.search_empty_hint()}</p>
              </>
            }
          />
        )}
      </div>
    </section>
  );
}

const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
};
function decode(text: string) {
  return text.replace(
    /&(?:amp|lt|gt|quot|#039);/g,
    (entity) => entities[entity],
  );
}
/** Render only the search API's mark delimiters; titles and excerpts remain text. */
function Highlighted({
  html,
  fallback,
}: {
  html: string | null;
  fallback: string;
}) {
  if (!html) return fallback;
  return html
    .split(/(<mark>.*?<\/mark>)/gs)
    .map((part, index) =>
      part.startsWith("<mark>") && part.endsWith("</mark>") ? (
        <mark key={index}>{decode(part.slice(6, -7))}</mark>
      ) : (
        decode(part)
      ),
    );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryParts(query: string) {
  return query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
}

function textHits(text: string, query: string) {
  return queryParts(query).some((part) => new RegExp(part, "i").test(text));
}

/** 日期、标签、分类这些纯文本里的命中同样标出来。 */
function QueryHighlight({ text, query }: { text: string; query: string }) {
  const parts = queryParts(query);
  if (parts.length === 0) return text;
  const pattern = new RegExp(`(${parts.join("|")})`, "gi");
  return (
    <>
      {text
        .split(pattern)
        .map((chunk, index) =>
          chunk &&
          parts.some((part) => new RegExp(`^${part}$`, "i").test(chunk)) ? (
            <mark key={index}>{chunk}</mark>
          ) : (
            chunk
          ),
        )}
    </>
  );
}
