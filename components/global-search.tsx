"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import type { GlobalSearchResult } from "@/types/search";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.5 4a6.5 6.5 0 1 0 4.02 11.61l4.44 4.45 1.06-1.06-4.45-4.44A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

type SearchResponse = {
  results?: GlobalSearchResult[];
};

function getSearchBadgeClassName(result: GlobalSearchResult) {
  if (result.kind !== "Gig" || !result.badge) {
    return "header-search-badge";
  }

  const normalizedBadge = result.badge
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  return `header-search-badge gig-status ${normalizedBadge}`;
}

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!deferredQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function runSearch() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(deferredQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Search request failed.");
        }

        const payload = (await response.json()) as SearchResponse;
        setResults(Array.isArray(payload.results) ? payload.results : []);
        setIsOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setIsOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    runSearch();

    return () => controller.abort();
  }, [deferredQuery]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "Enter" && results[0]) {
      event.preventDefault();
      setIsOpen(false);
      setQuery("");
      router.push(results[0].href);
    }
  }

  function handleResultClick() {
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="global-search">
      <label className="header-search">
        <input
          type="search"
          value={query}
          placeholder="Search gigs, artists, arenas..."
          aria-label="Search gigs, artists, arenas, staff, dates, files, and shifts"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (query.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="header-search-icon">
          <SearchIcon />
        </span>
      </label>

      {isOpen && query.trim() ? (
        <div className="header-search-panel" role="listbox" aria-label="Search results">
          {isLoading ? (
            <div className="header-search-status">Searching...</div>
          ) : results.length === 0 ? (
            <div className="header-search-status">
              No results. Try a different search.
            </div>
          ) : (
            <div className="header-search-list">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={result.href}
                  className="header-search-result"
                  onClick={handleResultClick}
                >
                  <div className="header-search-result-top">
                    <span
                      className={`header-search-kind ${result.kind
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {result.kind}
                    </span>
                    {result.badge ? (
                      <span className={getSearchBadgeClassName(result)}>{result.badge}</span>
                    ) : null}
                  </div>
                  <strong className="header-search-title">{result.title}</strong>
                  <span className="header-search-subtitle">{result.subtitle}</span>
                  {result.detail ? (
                    <span className="header-search-detail">{result.detail}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
