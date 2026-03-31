import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { canUsePlatformGlobalSearch } from "@/lib/platform-access";
import { searchGlobalContent } from "@/lib/global-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }

  if (!canUsePlatformGlobalSearch(currentProfile.roleKey)) {
    return NextResponse.json({ results: [] });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const results = query ? await searchGlobalContent(query) : [];

  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
