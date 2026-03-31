import Link from "next/link";

import {
  formatStaffAppCompactDate,
  getStaffAppMessageThreads,
} from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppMessagesPage() {
  const account = await requireCurrentStaffAppAccount();
  const threads = await getStaffAppMessageThreads(account);

  return (
    <section className="staff-app-screen">
      <div className="staff-app-page-head">
        <p className="staff-app-kicker">Messages</p>
        <h1>Shift-linked conversations.</h1>
        <p>
          Threads stay attached to the right shift or gig-wide staff update, so every
          message keeps its operational context.
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="staff-app-empty-state">No shift threads available right now.</div>
      ) : (
        <div className="staff-app-list">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/staff-app/messages/${thread.id}`}
              className="staff-app-card"
            >
              <div className="staff-app-section-head compact">
                <div>
                  <p className="staff-app-kicker">{thread.shiftTitle}</p>
                  <h2>{thread.eventName}</h2>
                </div>
                {thread.messages.length > 0 ? (
                  <span className="staff-app-badge alert">
                    {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="staff-app-badge neutral">No messages yet</span>
                )}
              </div>

              <div className="staff-app-detail-grid">
                <div className="staff-app-detail-cell">
                  <span>Venue</span>
                  <strong>{thread.venue}</strong>
                </div>
                <div className="staff-app-detail-cell">
                  <span>Date</span>
                  <strong>{formatStaffAppCompactDate(thread.date)}</strong>
                </div>
                <div className="staff-app-detail-cell">
                  <span>Contact person</span>
                  <strong>{thread.contactPerson}</strong>
                </div>
                <div className="staff-app-detail-cell">
                  <span>Latest message</span>
                  <strong>{thread.latestMessagePreview}</strong>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
