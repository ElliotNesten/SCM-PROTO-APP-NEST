import Link from "next/link";

import { SystemSettingsCompensationEditor } from "@/components/system-settings-compensation-editor";
import { SystemSettingsApplicationEmailEditor } from "@/components/system-settings-application-email-editor";
import { PageHeader } from "@/components/page-header";
import { SystemSettingsPolicyUploader } from "@/components/system-settings-policy-uploader";
import { SystemSettingsScmInfoEditor } from "@/components/system-settings-scm-info-editor";
import { SystemSettingsTemplateEditor } from "@/components/system-settings-template-editor";
import { SystemSettingsTextEditingPanel } from "@/components/system-settings-text-editing-panel";
import { SystemSettingsWorkspace } from "@/components/system-settings-workspace";
import { getPostmarkConfigurationStatus } from "@/lib/postmark";
import { requireSuperAdminProfile } from "@/lib/auth-session";
import { getSystemPolicySettings } from "@/lib/system-policy-store";
import { getSystemCompensationSettings } from "@/lib/system-compensation-store";
import { getApprovedApplicationEmailTemplate } from "@/lib/system-email-template-store";
import { getSystemScmInfoPdfSettings } from "@/lib/system-scm-info-pdf-store";
import { getSystemScmInfoSettings } from "@/lib/system-scm-info-store";
import { getSystemPdfTemplates } from "@/lib/system-template-store";

export default async function SystemSettingsPage() {
  await requireSuperAdminProfile();
  const [
    templateState,
    approvedApplicationEmailTemplate,
    policySettings,
    compensationSettings,
    scmInfoSettings,
    scmInfoPdfSettings,
  ] =
    await Promise.all([
      getSystemPdfTemplates(),
      getApprovedApplicationEmailTemplate(),
      getSystemPolicySettings(),
      getSystemCompensationSettings(),
      getSystemScmInfoSettings(),
      getSystemScmInfoPdfSettings(),
    ]);
  const postmarkStatus = getPostmarkConfigurationStatus();

  return (
    <>
      <PageHeader
        eyebrow="SYSTEM SETTINGS"
        title="System Settings"
        subtitle="Manage salary defaults, PDF templates, arena catalog, and shared SCM content used across the platform and staff app."
        actions={
          <Link href="/dashboard" className="button ghost">
            Back to dashboard
          </Link>
        }
      />

      <SystemSettingsWorkspace
        sections={[
          {
            id: "global-text",
            eyebrow: "Quick Actions",
            title: "Global text and labels",
            description:
              "Enable inline editing for shared UI copy across the platform.",
            summary: "Interface copy, labels, and helper text",
            keywords: ["text", "copy", "labels", "buttons", "headings"],
            content: <SystemSettingsTextEditingPanel />,
          },
          {
            id: "application-email",
            eyebrow: "Onboarding",
            title: "Approved application email",
            description:
              "Adjust the activation email, support details, and Postmark delivery setup.",
            summary: "Email template and delivery settings",
            keywords: ["email", "activation", "postmark", "support", "approval"],
            content: (
              <SystemSettingsApplicationEmailEditor
                initialTemplate={approvedApplicationEmailTemplate}
                postmarkStatus={postmarkStatus}
              />
            ),
          },
          {
            id: "policy-pdf",
            eyebrow: "Documents",
            title: "SCM staff policy PDF",
            description:
              "Replace the live policy PDF that opens inside the staff app.",
            summary: "Policy upload and current live file",
            keywords: ["policy", "pdf", "upload", "staff app", "document"],
            content: <SystemSettingsPolicyUploader initialPolicy={policySettings} />,
          },
          {
            id: "compensation",
            eyebrow: "Compensation",
            title: "Hourly wage defaults",
            description:
              "Manage country-by-country standard rates for each staff role.",
            summary: "Salary defaults for Sweden, Norway, Denmark, and Finland",
            keywords: ["salary", "wage", "hourly", "compensation", "rates"],
            content: (
              <SystemSettingsCompensationEditor initialSettings={compensationSettings} />
            ),
          },
          {
            id: "staff-app-guides",
            eyebrow: "Staff App",
            title: "Guides, arenas, and SCM info",
            description:
              "Edit roles and training, checklists, arena content, policy links, and shared SCM info.",
            summary: "Guides, PDFs, arena info, and staff app content",
            keywords: ["guides", "arena", "roles", "training", "checklists", "cash"],
            content: (
              <SystemSettingsScmInfoEditor
                initialSettings={scmInfoSettings}
                initialPdfs={scmInfoPdfSettings}
              />
            ),
          },
          {
            id: "pdf-templates",
            eyebrow: "PDF Output",
            title: "Employment and time report templates",
            description:
              "Configure generated PDF content and preview the final output before saving.",
            summary: "Contract and time report templates with live preview",
            keywords: ["template", "pdf", "contract", "time report", "placeholders"],
            content: <SystemSettingsTemplateEditor initialTemplates={templateState.templates} />,
          },
        ]}
      />
    </>
  );
}
