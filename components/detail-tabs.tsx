"use client";

import Link from "next/link";
import { useState } from "react";

type DetailTab<T extends string> = {
  slug: T;
  label: string;
};

type BlockedDetailTab = {
  title?: string;
  message: string;
};

export function DetailTabs<T extends string>({
  tabs,
  current,
  basePath,
  getHref,
  blockedTabs,
}: {
  tabs: DetailTab<T>[];
  current: T;
  basePath: string;
  getHref?: (tab: DetailTab<T>) => string;
  blockedTabs?: Partial<Record<T, BlockedDetailTab>>;
}) {
  const [activeBlockedTab, setActiveBlockedTab] = useState<{
    label: string;
    title: string;
    message: string;
  } | null>(null);

  return (
    <>
      <div className="route-tabs">
        {tabs.map((tab) => {
          const blockedTab = blockedTabs?.[tab.slug];

          if (blockedTab) {
            return (
              <button
                key={tab.slug}
                type="button"
                className="route-tab route-tab-button disabled"
                aria-disabled="true"
                onClick={() =>
                  setActiveBlockedTab({
                    label: tab.label,
                    title: blockedTab.title ?? `${tab.label} locked`,
                    message: blockedTab.message,
                  })
                }
              >
                {tab.label}
              </button>
            );
          }

          const href =
            getHref?.(tab) ??
            (tab.slug === "overview" ? basePath : `${basePath}?tab=${tab.slug}`);

          return (
            <Link
              key={tab.slug}
              href={href}
              className={`route-tab ${current === tab.slug ? "active" : ""}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {activeBlockedTab ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blocked-tab-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">{activeBlockedTab.label}</p>
                <h2 id="blocked-tab-title">{activeBlockedTab.title}</h2>
                <p className="page-subtitle">{activeBlockedTab.message}</p>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setActiveBlockedTab(null)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
