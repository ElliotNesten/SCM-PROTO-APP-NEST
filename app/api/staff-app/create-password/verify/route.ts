import { NextResponse } from "next/server";

import { verifyPasswordSetupToken } from "@/lib/password-setup-token-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const verification = await verifyPasswordSetupToken(token);

  return NextResponse.json({
    ok: verification.state === "valid",
    state: verification.state,
    subjectType: verification.record?.subjectType ?? "staffApp",
    email: verification.record?.email ?? null,
    expiresAt: verification.record?.expiresAt ?? null,
  });
}
