import { NextResponse } from "next/server";

import { invalidatePasswordSetupToken } from "@/lib/password-setup-token-store";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        token?: string;
      }
    | null;

  const token = payload?.token?.trim() ?? "";

  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const invalidatedToken = await invalidatePasswordSetupToken(token);

  if (!invalidatedToken) {
    return NextResponse.json({ error: "Token not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    invalidatedAt: invalidatedToken.invalidatedAt,
  });
}
