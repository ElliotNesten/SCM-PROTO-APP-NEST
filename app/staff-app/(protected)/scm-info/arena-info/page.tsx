import { StaffAppArenaDirectory } from "@/components/staff-app/arena-directory";
import { StaffAppGuidePdfLink } from "@/components/staff-app/guide-pdf-link";
import { StaffAppPageBackLink } from "@/components/staff-app/page-back-link";
import { getAllStoredGigs } from "@/lib/gig-store";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";
import { getStaffAppScmInfoPdfButtonLabel } from "@/lib/system-scm-info-pdf-shared";
import { getSystemScmInfoPdfSettings } from "@/lib/system-scm-info-pdf-store";
import {
  getSystemScmInfoSettings,
  renderArenaNoteTemplate,
} from "@/lib/system-scm-info-store";

type ArenaDirectoryItem = {
  id: string;
  country: string;
  arena: string;
  city: string;
  region: string;
  gigCount: number;
  latestDate: string;
  notes: string;
};

function buildArenaDirectory(
  gigs: Awaited<ReturnType<typeof getAllStoredGigs>>,
  fallbackArenaNoteTemplate: string,
) {
  const groupedArenas = new Map<string, ArenaDirectoryItem>();

  for (const gig of gigs) {
    const key = `${gig.country}::${gig.arena}::${gig.city}`;
    const existingArena = groupedArenas.get(key);
    const notes =
      gig.arenaNotes?.trim() ||
      gig.notes?.trim() ||
      renderArenaNoteTemplate(fallbackArenaNoteTemplate, {
        arena: gig.arena,
        city: gig.city,
        country: gig.country,
      });

    if (!existingArena) {
      groupedArenas.set(key, {
        id: key,
        country: gig.country,
        arena: gig.arena,
        city: gig.city,
        region: gig.region,
        gigCount: 1,
        latestDate: gig.date,
        notes,
      });
      continue;
    }

    existingArena.gigCount += 1;

    if (gig.date > existingArena.latestDate) {
      existingArena.latestDate = gig.date;
      existingArena.notes = notes;
    }
  }

  return Array.from(groupedArenas.values()).sort((left, right) => {
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
  const [account, gigs, scmInfoSettings, pdfSettings] = await Promise.all([
    requireCurrentStaffAppAccount(),
    getAllStoredGigs(),
    getSystemScmInfoSettings(),
    getSystemScmInfoPdfSettings(),
  ]);
  const arenas = buildArenaDirectory(gigs, scmInfoSettings.arenaInfo.fallbackArenaNoteTemplate);
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
