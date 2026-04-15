export const dynamic = "force-dynamic";

import { StaffAppGuideDisclosureList } from "@/components/staff-app/guide-disclosure-list";
import { StaffAppGuidePdfLink } from "@/components/staff-app/guide-pdf-link";
import { StaffAppPageBackLink } from "@/components/staff-app/page-back-link";
import { formatStaffAppApprovedRolesLabel } from "@/lib/staff-app-scope";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";
import {
  getStaffAppScmInfoPdfButtonLabel,
  getSystemScmInfoItemPdfKey,
} from "@/lib/system-scm-info-pdf-shared";
import { getSystemScmInfoPdfSettings } from "@/lib/system-scm-info-pdf-store";
import { getSystemScmInfoSettings } from "@/lib/system-scm-info-store";

export default async function StaffAppRolesTrainingPage() {
  const [account, scmInfoSettings, pdfSettings] = await Promise.all([
    requireCurrentStaffAppAccount(),
    getSystemScmInfoSettings(),
    getSystemScmInfoPdfSettings(),
  ]);
  const section = scmInfoSettings.rolesTraining;
  const pagePdfs = pdfSettings.sectionPdfs.rolesTraining.filter((pdf) => pdf.pdfUrl);
  const itemPdfs = section.items.map((_, index) =>
    (pdfSettings.itemPdfs[getSystemScmInfoItemPdfKey("rolesTraining", index)] ?? []).filter(
      (pdf) => pdf.pdfUrl,
    ),
  );

  return (
    <section className="staff-app-screen staff-app-guide-page">
      <StaffAppPageBackLink href="/staff-app/scm-info" label="Back to SCM info" />

      <div className="staff-app-page-head">
        <p className="staff-app-kicker">Guides</p>
        <h1>{section.pageTitle}</h1>
        <p>
          {section.pageDescription} Approved roles:{" "}
          {formatStaffAppApprovedRolesLabel(account.roleScopes)}.
        </p>
      </div>

      {pagePdfs.length > 0 ? (
        <div className="staff-app-guide-page-actions">
          {pagePdfs.map((pdf, pdfIndex) => (
            <StaffAppGuidePdfLink
              key={`roles-training-pdf-${pdfIndex}`}
              href={pdf.pdfUrl}
              label={getStaffAppScmInfoPdfButtonLabel(pdf, `Open guide PDF ${pdfIndex + 1}`)}
            />
          ))}
        </div>
      ) : null}

      <StaffAppGuideDisclosureList items={section.items} itemPdfs={itemPdfs} />
    </section>
  );
}
