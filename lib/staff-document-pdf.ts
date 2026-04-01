import type { StoredStaffDocument } from "@/types/staff-documents";
import { getSystemPdfTemplate } from "@/lib/system-template-store";
import { buildShiftPdfTemplateLines } from "@/types/system-settings";

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatDocumentDate(value: string) {
  const parsedDate = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  }).format(parsedDate);
}

function getTemplateIdFromDocumentKind(documentKind: StoredStaffDocument["documentKind"]) {
  return documentKind === "Employment Contract"
    ? "employmentContract"
    : "timeReport";
}

function createPdfBuffer(lines: string[]) {
  const contentLines = [
    "BT",
    "/F1 22 Tf",
    "50 760 Td",
    `(${escapePdfText(lines[0] ?? "Staff document")}) Tj`,
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

export async function buildStaffDocumentPdf(document: StoredStaffDocument) {
  const template = await getSystemPdfTemplate(
    getTemplateIdFromDocumentKind(document.documentKind),
  );
  const lines = buildShiftPdfTemplateLines(template, {
    documentKind: document.documentKind,
    gigName: document.gigName,
    gigDate: formatDocumentDate(document.gigDate),
    shiftRole: document.shiftRole,
    generatedDate: formatDocumentDate(document.gigDate),
    referenceId: document.id,
  });

  return createPdfBuffer(lines);
}
