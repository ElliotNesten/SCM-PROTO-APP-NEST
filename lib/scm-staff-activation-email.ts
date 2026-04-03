import { getApprovedApplicationEmailTemplate } from "@/lib/system-email-template-store";
import { getPostmarkConfigurationStatus, sendPostmarkEmail } from "@/lib/postmark";
import { getScmRoleDefinition, type StoredScmStaffProfile } from "@/types/scm-rbac";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestampForEmail(isoString: string) {
  return new Date(isoString).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  });
}

function getPublicAppBaseUrl(createPasswordUrl: string) {
  try {
    return new URL(createPasswordUrl).origin.replace(/\/$/, "");
  } catch {
    return (process.env.SCM_APP_BASE_URL?.trim() || "http://localhost:3000").replace(
      /\/$/,
      "",
    );
  }
}

export async function sendScmStaffActivationEmail(input: {
  profile: StoredScmStaffProfile;
  createPasswordUrl: string;
  expiresAt: string;
}) {
  const template = await getApprovedApplicationEmailTemplate();
  const supportEmail = template.supportEmail.trim() || "INFO@scm.se";
  const roleLabel = getScmRoleDefinition(input.profile.roleKey).label;
  const headline = `Set your SCM Staff password, ${input.profile.firstName}`;
  const expiryLabel = formatTimestampForEmail(input.expiresAt);
  const subject = `Your SCM Staff account is ready`;
  const preheader = `Create your password and activate your SCM Staff access within 24 hours.`;
  const appBaseUrl = getPublicAppBaseUrl(input.createPasswordUrl);
  const logoUrl = `${appBaseUrl}/brand/scm-logo.svg`;
  const htmlBody = `
    <html lang="en">
      <body style="margin:0;padding:0;background:#eef3f8;font-family:Aptos,'Segoe UI',Arial,sans-serif;color:#14233d;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 48px rgba(20,35,61,0.12);">
                <tr>
                  <td bgcolor="#10203a" style="padding:32px 36px;background-color:#10203a;background-image:linear-gradient(135deg,#10203a,#27446f);color:#f7fbff;">
                    <img src="${logoUrl}" alt="SCM" width="168" style="display:block;width:168px;max-width:100%;height:auto;margin:0 0 22px;border:0;outline:none;text-decoration:none;" />
                    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#d8e7fa;">SCM STAFF</p>
                    <h1 style="margin:0;font-size:32px;line-height:1.08;color:#f7fbff;">${escapeHtml(headline)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px;">
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#243752;">
                      A new SCM Staff account has been created for you with the role <strong>${escapeHtml(roleLabel)}</strong>.
                    </p>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#243752;">
                      Click the button below to create your own password and activate your SCM access. For security reasons, SCM never sends passwords by email.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;">
                      <tr>
                        <td align="center" style="border-radius:999px;background:#10203a;">
                          <a href="${input.createPasswordUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:700;">Create your password</a>
                        </td>
                      </tr>
                    </table>
                    <div style="padding:18px 20px;border-radius:18px;background:#f5f8fc;border:1px solid #d6e0ee;">
                      <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#203252;">
                        This link is valid until ${escapeHtml(expiryLabel)}.
                      </p>
                      <p style="margin:0;font-size:14px;line-height:1.65;color:#506482;">
                        If the link has expired or you were not expecting this email, contact ${escapeHtml(supportEmail)}.
                      </p>
                    </div>
                    <div style="margin-top:28px;">
                      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#1f324f;">Best regards,</p>
                      <p style="margin:0;font-size:15px;line-height:1.6;color:#1f324f;">SCM Team</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:13px;line-height:1.65;color:#66788f;">
                      This is an automated SCM Staff activation email. Reply to ${escapeHtml(supportEmail)} if you need help.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();
  const textBody = [
    headline,
    "",
    `A new SCM Staff account has been created for you with the role ${roleLabel}.`,
    "",
    "Create your password and activate your SCM access here:",
    input.createPasswordUrl,
    "",
    `This link is valid until ${expiryLabel}.`,
    `If you need help, contact ${supportEmail}.`,
    "",
    "Best regards,",
    "SCM Team",
  ]
    .join("\n")
    .trim();

  const delivery = await sendPostmarkEmail({
    to: input.profile.email,
    subject,
    htmlBody,
    textBody,
    replyTo: supportEmail,
  });

  return {
    ...delivery,
    configuration: getPostmarkConfigurationStatus(),
  };
}
