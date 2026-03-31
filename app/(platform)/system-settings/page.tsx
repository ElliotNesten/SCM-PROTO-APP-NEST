import Link from "next/link";

import { SystemSettingsCompensationEditor } from "@/components/system-settings-compensation-editor";
import { PageHeader } from "@/components/page-header";
import { SystemSettingsPolicyUploader } from "@/components/system-settings-policy-uploader";
import { SystemSettingsScmInfoEditor } from "@/components/system-settings-scm-info-editor";
import { SystemSettingsTemplateEditor } from "@/components/system-settings-template-editor";
import { SystemSettingsTextEditingPanel } from "@/components/system-settings-text-editing-panel";
import { requireSuperAdminProfile } from "@/lib/auth-session";
import { getSystemPolicySettings } from "@/lib/system-policy-store";
import { getSystemCompensationSettings } from "@/lib/system-compensation-store";
import { getSystemScmInfoPdfSettings } from "@/lib/system-scm-info-pdf-store";
import { getSystemScmInfoSettings } from "@/lib/system-scm-info-store";
import { getSystemPdfTemplates } from "@/lib/system-template-store";

export default async function SystemSettingsPage() {
  await requireSuperAdminProfile();
  const [
    templateState,
    policySettings,
    compensationSettings,
    scmInfoSettings,
    scmInfoPdfSettings,
  ] =
    await Promise.all([
      getSystemPdfTemplates(),
      getSystemPolicySettings(),
      getSystemCompensationSettings(),
      getSystemScmInfoSettings(),
      getSystemScmInfoPdfSettings(),
    ]);

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

      <SystemSettingsTextEditingPanel />
      <SystemSettingsPolicyUploader initialPolicy={policySettings} />
      <SystemSettingsCompensationEditor initialSettings={compensationSettings} />
      <SystemSettingsScmInfoEditor
        initialSettings={scmInfoSettings}
        initialPdfs={scmInfoPdfSettings}
      />
      <SystemSettingsTemplateEditor initialTemplates={templateState.templates} />
    </>
  );
}
