import { StaffAppArenaDirectory } from "@/components/staff-app/arena-directory";
import { StaffAppGuidePdfLink } from "@/components/staff-app/guide-pdf-link";
import { StaffAppPageBackLink } from "@/components/staff-app/page-back-link";
import {
  arenaCatalogDocumentKeys,
  getArenaCatalogDocumentLabel,
  type ArenaCatalogEntry,
} from "@/data/predefined-arenas";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";
import { getStaffAppScmInfoPdfButtonLabel } from "@/lib/system-scm-info-pdf-shared";
import { getSystemScmInfoPdfSettings } from "@/lib/system-scm-info-pdf-store";
import { getSystemScmInfoSettings } from "@/lib/system-scm-info-store";

type ArenaDirectoryItem = {
  id: string;
  country: string;
  arena: string;
  city: string;
  documents: Array<{
    id: string;
    label: string;
    href: string;
  }>;
};

function buildArenaDirectory(arenaCatalog: readonly ArenaCatalogEntry[]): ArenaDirectoryItem[] {
  return [...arenaCatalog]
    .map((arena) => ({
      id: arena.id,
      country: arena.country,
      arena: arena.name,
      city: arena.city,
      documents: arenaCatalogDocumentKeys.map((documentKey) => ({
        id: `${arena.id}:${documentKey}`,
        label: getArenaCatalogDocumentLabel(documentKey),
        href: arena.documents[documentKey].pdfUrl,
      })),
    }))
    .sort((left, right) => {
      if (left.country !== right.country) {
        return left.country.localeCompare(right.country);
      }

      if (left.city !== right.city) {
        return left.city.localeCompare(right.city);
      }

      return left.arena.localeCompare(right.arena);
    });
}

export default async function StaffAppArenaInfoPage() {
  const [account, scmInfoSettings, pdfSettings] = await Promise.all([
    requireCurrentStaffAppAccount(),
    getSystemScmInfoSettings(),
    getSystemScmInfoPdfSettings(),
  ]);
  const arenas = buildArenaDirectory(scmInfoSettings.arenaInfo.catalog);
  const pagePdfs = pdfSettings.sectionPdfs.arenaInfo.filter((pdf) => pdf.pdfUrl);

  return (
    <section className="staff-app-screen staff-app-guide-page">
      <StaffAppPageBackLink href="/staff-app/scm-info" label="Back to SCM info" />

      <div className="staff-app-page-head">
        <p className="staff-app-kicker">Guides</p>
        <h1>{scmInfoSettings.arenaInfo.pageTitle}</h1>
        <p>{scmInfoSettings.arenaInfo.pageDescription}</p>
      </div>

      {pagePdfs.length > 0 ? (
        <div className="staff-app-guide-page-actions">
          {pagePdfs.map((pdf, pdfIndex) => (
            <StaffAppGuidePdfLink
              key={`arena-info-pdf-${pdfIndex}`}
              href={pdf.pdfUrl}
              label={getStaffAppScmInfoPdfButtonLabel(pdf, `Open guide PDF ${pdfIndex + 1}`)}
            />
          ))}
        </div>
      ) : null}

      <StaffAppArenaDirectory
        arenas={arenas}
        defaultCountry={account.country}
        emptyStateMessage={scmInfoSettings.arenaInfo.emptyStateMessage}
      />
    </section>
  );
}
