import { NextResponse } from "next/server";

import { getTextCustomizationState } from "@/lib/text-customization-store";

export async function GET() {
  const state = await getTextCustomizationState();

  return NextResponse.json({
    overrides: state.overrides,
    updatedAt: state.updatedAt,
  });
}
