import { NextResponse } from "next/server";

import { buildStaffDocumentPdf } from "@/lib/staff-document-pdf";
import { getStoredStaffDocumentById } from "@/lib/staff-document-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ personId: string; documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { personId, documentId } = await context.params;
  const document = await getStoredStaffDocumentById(personId, documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const pdfBuffer = await buildStaffDocumentPdf(document);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
      "Content-Length": String(pdfBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
