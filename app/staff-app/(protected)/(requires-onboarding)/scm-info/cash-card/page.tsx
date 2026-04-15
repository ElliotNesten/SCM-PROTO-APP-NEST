export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function StaffAppCashCardPage() {
  redirect("/staff-app/scm-info");
}
