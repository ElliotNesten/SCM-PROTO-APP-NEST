import { StaffAppColleagueDirectory } from "@/components/staff-app/colleague-directory";
import { getStaffAppColleagues } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppColleaguesPage() {
  const account = await requireCurrentStaffAppAccount();
  const colleagues = await getStaffAppColleagues(account);

  return (
    <section className="staff-app-screen staff-app-colleagues-screen">
      <div className="staff-app-page-head">
        <h1 className="staff-app-colleagues-title">My Colleagues</h1>
        <p>
          Only approved teammates in {account.country}, {account.region} are shown here.
        </p>
      </div>

      {colleagues.length === 0 ? (
        <div className="staff-app-empty-state">
          No approved colleagues are currently available in your local region.
        </div>
      ) : (
        <StaffAppColleagueDirectory colleagues={colleagues} />
      )}
    </section>
  );
}
