export const dynamic = "force-dynamic";

import Link from "next/link";

import { getSystemPolicySettings } from "@/lib/system-policy-store";
import { getSystemScmInfoPdfSettings } from "@/lib/system-scm-info-pdf-store";
import { getSystemScmInfoSettings } from "@/lib/system-scm-info-store";
import type { StaffAppScmInfoSectionKey } from "@/lib/system-scm-info-store";

function StaffAppGuidesHeroIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 3.5h6l4 4v12A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5v-14A2 2 0 0 1 8 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StaffAppGuideTileIcon({
  kind,
}: {
  kind: "roles" | "checklists" | "info" | "policy" | "cash" | "arena";
}) {
  switch (kind) {
    case "roles":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M6.5 18.5a5.5 5.5 0 0 1 11 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "checklists":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="5.5" width="12" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M9.5 3.5h5M9 10.5h6M9 14h6M9 17.5h4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 6h8M8 12h8M8 18h8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <path
            d="M5 6h.01M5 12h.01M5 18h.01"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.6"
          />
        </svg>
      );
    case "policy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 3.5h6l4 4v12A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5v-14A2 2 0 0 1 8 3.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M10 11.5h4M10 15h4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "cash":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="7" width="15" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M8 7V5.5M16 7V5.5M8 18.5V17M16 18.5V17"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "arena":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 17.5 12 6l7.5 11.5H4.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M9 14.5h6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    default:
      return null;
  }
}

type StaffAppGuideCard = {
  href: string;
  kind: "roles" | "checklists" | "info" | "policy" | "arena";
  settingsKey: StaffAppScmInfoSectionKey;
  external?: boolean;
};

const guideCards: StaffAppGuideCard[] = [
  {
    href: "/staff-app/scm-info/roles-training",
    kind: "roles" as const,
    settingsKey: "rolesTraining",
  },
  {
    href: "/staff-app/scm-info/checklists",
    kind: "checklists" as const,
    settingsKey: "checklists",
  },
  {
    href: "/staff-app/scm-info/platform-info",
    kind: "info" as const,
    settingsKey: "platformInfo",
  },
  {
    href: "/api/staff-app/policy-pdf",
    kind: "policy" as const,
    settingsKey: "policy",
    external: true,
  },
  {
    href: "/staff-app/scm-info/arena-info",
    kind: "arena" as const,
    settingsKey: "arenaInfo",
  },
] as const;

export default async function StaffAppScmInfoPage() {
  const [scmInfoSettings, pdfSettings, policySettings] = await Promise.all([
    getSystemScmInfoSettings(),
    getSystemScmInfoPdfSettings(),
    getSystemPolicySettings(),
  ]);

  return (
    <section className="staff-app-screen staff-app-guides-screen">
      <div className="staff-app-guides-hero">
        <span className="staff-app-guides-hero-icon" aria-hidden="true">
          <StaffAppGuidesHeroIcon />
        </span>
        <p className="staff-app-kicker">{scmInfoSettings.hubKicker}</p>
        <h1>{scmInfoSettings.hubTitle}</h1>
      </div>

      <div className="staff-app-guides-grid">
        {guideCards.map((card) => {
          const pdfCount =
            card.settingsKey === "policy"
              ? Number(Boolean(policySettings.policyUrl))
              : pdfSettings.sectionPdfs[card.settingsKey].filter((pdf) => pdf.pdfUrl).length;

          return card.external ? (
            <a key={card.settingsKey} href={card.href} className="staff-app-guide-tile">
              <span className="staff-app-guide-tile-icon" aria-hidden="true">
                <StaffAppGuideTileIcon kind={card.kind} />
              </span>
              <strong>{scmInfoSettings.hubCards[card.settingsKey].title}</strong>
              <span className="staff-app-guide-tile-subtitle">
                {scmInfoSettings.hubCards[card.settingsKey].subtitle}
              </span>
              {pdfCount > 0 ? (
                <span className="staff-app-guide-tile-pill">
                  {pdfCount} PDF{pdfCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </a>
          ) : (
            <Link key={card.settingsKey} href={card.href} className="staff-app-guide-tile">
              <span className="staff-app-guide-tile-icon" aria-hidden="true">
                <StaffAppGuideTileIcon kind={card.kind} />
              </span>
              <strong>{scmInfoSettings.hubCards[card.settingsKey].title}</strong>
              <span className="staff-app-guide-tile-subtitle">
                {scmInfoSettings.hubCards[card.settingsKey].subtitle}
              </span>
              {pdfCount > 0 ? (
                <span className="staff-app-guide-tile-pill">
                  {pdfCount} PDF{pdfCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
