import { NextResponse } from "next/server";

import { createAuthSession } from "@/lib/auth-session";
import { activateStaffAccountWithPassword } from "@/lib/staff-account-activation";
import { createStaffAppSession } from "@/lib/staff-app-session";
import { touchStaffAppAccountLastLogin } from "@/lib/staff-app-store";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        token?: string;
        password?: string;
      }
    | null;

  const token = payload?.token?.trim() ?? "";
  const password = payload?.password?.trim() ?? "";

  if (!token || !password) {
    return NextResponse.json(
      { error: "Token and password are required." },
      { status: 400 },
    );
  }

  const activation = await activateStaffAccountWithPassword({
    token,
    password,
  });

  if (!activation.ok) {
    return NextResponse.json({ error: activation.error }, { status: activation.status });
  }

  if (activation.subjectType === "scmStaff") {
    await createAuthSession(activation.profile.id);

    return NextResponse.json({
      ok: true,
      redirectTo: "/dashboard",
    });
  }

  await createStaffAppSession({
    subjectType: "staff",
    accountId: activation.account.id,
  });
  await touchStaffAppAccountLastLogin(activation.account.id);

  return NextResponse.json({
    ok: true,
    redirectTo: "/staff-app/onboarding",
  });
}
