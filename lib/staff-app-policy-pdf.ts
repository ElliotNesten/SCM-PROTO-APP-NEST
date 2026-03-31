function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdfBuffer(lines: string[]) {
  const contentLines = [
    "BT",
    "/F1 22 Tf",
    "50 760 Td",
    `(${escapePdfText(lines[0] ?? "SCM policy")}) Tj`,
    "/F1 12 Tf",
    "0 -28 Td",
    ...lines.slice(1).map((line, index) => {
      if (index === 0) {
        return `(${escapePdfText(line)}) Tj`;
      }

      return [`0 -18 Td`, `(${escapePdfText(line)}) Tj`].join("\n");
    }),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    [
      "3 0 obj",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]",
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "endobj\n",
    ].join(" "),
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentLines, "utf8")} >>\nstream\n${contentLines}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function buildStaffAppPolicyPdf() {
  return createPdfBuffer([
    "SCM Staff Policy",
    "Arrival: Be at the meeting point at least 15 minutes before the stated time unless shift notes say otherwise.",
    "Uniform: Wear approved SCM clothing, badge, and any role-specific equipment.",
    "Attendance: Use Check In / Out on the active shift day so time reporting stays aligned.",
    "Communication: Keep operational questions in the shift-linked message thread unless the situation is urgent.",
    "Cash and Card: Protect floats, report terminal issues immediately, and complete closeout before leaving the venue.",
    "Safety: Escalate hazards, blocked exits, or unsafe crowd flow to the responsible manager at once.",
    "Reference date: 29 March 2026.",
  ]);
}
