import { buildStaffAppPolicyPdf } from "@/lib/staff-app-policy-pdf";
import { getSystemPolicySettings } from "@/lib/system-policy-store";

export async function GET(request: Request) {
  const policySettings = await getSystemPolicySettings();

  if (policySettings.policyUrl) {
    return Response.redirect(new URL(policySettings.policyUrl, request.url), 307);
  }

  const pdfBuffer = buildStaffAppPolicyPdf();

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="scm-staff-policy.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
