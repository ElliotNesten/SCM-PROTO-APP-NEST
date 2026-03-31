import { getApprovedApplicationEmailTemplate } from "@/lib/system-email-template-store";
import { getPostmarkConfigurationStatus, sendPostmarkEmail } from "@/lib/postmark";
import type { StoredStaffApplication } from "@/types/job-applications";

function replaceTemplateVariables(
  value: string,
  variables: Record<string, string>,
) {
  return Object.entries(variables).reduce(
    (currentValue, [key, replacement]) =>
      currentValue.replaceAll(`{{${key}}}`, replacement),
    value,
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraphize(text: string) {
  return text
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function formatTimestampForEmail(isoString: string) {
  return new Date(isoString).toLocaleString("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export async function sendApprovedStaffApplicationEmail(input: {
  application: StoredStaffApplication;
  createPasswordUrl: string;
  expiresAt: string;
}) {
  const template = await getApprovedApplicationEmailTemplate();
  const supportEmail = template.supportEmail.trim() || "INFO@scm.se";
  const variables = {
    name: input.application.displayName,
    createPasswordUrl: input.createPasswordUrl,
    expiresAt: formatTimestampForEmail(input.expiresAt),
    supportEmail,
  };
  const subject = replaceTemplateVariables(template.subject, variables);
  const preheader = replaceTemplateVariables(template.preheader, variables);
  const headline = replaceTemplateVariables(template.headline, variables);
  const intro = replaceTemplateVariables(template.intro, variables);
  const body = replaceTemplateVariables(template.body, variables);
  const ctaLabel = replaceTemplateVariables(template.ctaLabel, variables);
  const expiryNotice = replaceTemplateVariables(template.expiryNotice, variables);
  const helpText = replaceTemplateVariables(template.helpText, variables);
  const signature = replaceTemplateVariables(template.signature, variables);
  const footerText = replaceTemplateVariables(template.footerText, variables);
  const introParagraphs = paragraphize(intro);
  const bodyParagraphs = paragraphize(body);
  const signatureLines = signature
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const htmlBody = `
    <html lang="sv">
      <body style="margin:0;padding:0;background:#eef3f8;font-family:Aptos,'Segoe UI',Arial,sans-serif;color:#14233d;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 48px rgba(20,35,61,0.12);">
                <tr>
                  <td style="padding:32px 36px;background:linear-gradient(135deg,#10203a,#27446f);color:#f7fbff;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.82;">SCM</p>
                    <h1 style="margin:0;font-size:32px;line-height:1.08;">${escapeHtml(headline)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px;">
                    ${introParagraphs
                      .map(
                        (paragraph) =>
                          `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#324764;">${escapeHtml(paragraph)}</p>`,
                      )
                      .join("")}
                    ${bodyParagraphs
                      .map(
                        (paragraph) =>
                          `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#324764;">${escapeHtml(paragraph)}</p>`,
                      )
                      .join("")}
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;">
                      <tr>
                        <td align="center" style="border-radius:999px;background:#10203a;">
                          <a href="${input.createPasswordUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(ctaLabel)}</a>
                        </td>
                      </tr>
                    </table>
                    <div style="padding:18px 20px;border-radius:18px;background:#f5f8fc;border:1px solid #d6e0ee;">
                      <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#203252;">${escapeHtml(expiryNotice)}</p>
                      <p style="margin:0;font-size:14px;line-height:1.65;color:#506482;">${escapeHtml(helpText)}</p>
                    </div>
                    <div style="margin-top:28px;">
                      ${signatureLines
                        .map(
                          (line) =>
                            `<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#1f324f;">${escapeHtml(line)}</p>`,
                        )
                        .join("")}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:13px;line-height:1.65;color:#66788f;">${escapeHtml(footerText)}</p>
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
    ...introParagraphs,
    "",
    ...bodyParagraphs,
    "",
    `${ctaLabel}: ${input.createPasswordUrl}`,
    "",
    expiryNotice,
    helpText,
    "",
    ...signatureLines,
    "",
    footerText,
  ]
    .join("\n")
    .trim();
  const delivery = await sendPostmarkEmail({
    to: input.application.email,
    subject,
    htmlBody,
    textBody,
    replyTo: supportEmail,
  });

  return {
    ...delivery,
    template,
    configuration: getPostmarkConfigurationStatus(),
  };
}
