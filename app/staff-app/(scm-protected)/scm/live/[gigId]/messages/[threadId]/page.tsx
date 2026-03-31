import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatStaffAppCompactDate,
  formatStaffAppTimestamp,
} from "@/lib/staff-app-data";
import {
  getStaffAppScmGigConversationThreadById,
  getStaffAppScmGigWorkspace,
} from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

import { sendScmGigConversationReplyAction } from "../../../actions";

type StaffAppScmConversationThreadPageProps = {
  params: Promise<{ gigId: string; threadId: string }>;
};

export default async function StaffAppScmConversationThreadPage({
  params,
}: StaffAppScmConversationThreadPageProps) {
  const { gigId, threadId } = await params;
  const profile = await requireCurrentStaffAppScmProfile();
  const [workspace, thread] = await Promise.all([
    getStaffAppScmGigWorkspace(profile, gigId),
    getStaffAppScmGigConversationThreadById(profile, gigId, threadId),
  ]);

  if (!workspace || !thread) {
    notFound();
  }

  const livePath = `/staff-app/scm/live/${gigId}`;

  return (
    <section className="staff-app-screen staff-app-scm-screen">
      <Link href={livePath} className="staff-app-back-link">
        Back to live view
      </Link>

      <div className="staff-app-card emphasis">
        <p className="staff-app-kicker">{thread.audienceLabel}</p>
        <h1>{thread.title}</h1>
        <p className="staff-app-muted">
          {workspace.gig.artist} | {workspace.gig.arena}, {workspace.gig.city} |{" "}
          {formatStaffAppCompactDate(workspace.gig.date)}
        </p>
        <div className="staff-app-chip-row">
          <span className="staff-app-chip">
            {thread.recipientCount} recipient
            {thread.recipientCount === 1 ? "" : "s"}
          </span>
          <span className="staff-app-chip">
            {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
          </span>
          {thread.allowReplies === false ? (
            <span className="staff-app-chip warning">Replies off for staff</span>
          ) : (
            <span className="staff-app-chip">Replies on</span>
          )}
        </div>
      </div>

      {thread.messages.length === 0 ? (
        <div className="staff-app-empty-state">
          No communication has been sent in this thread yet.
        </div>
      ) : (
        <div className="staff-app-chat-stack">
          {thread.messages.map((message) => (
            <article
              key={message.id}
              className={`staff-app-chat-bubble ${message.direction}`}
            >
              <strong>{message.author}</strong>
              {message.body.trim() ? <p>{message.body}</p> : null}
              {message.attachments.length > 0 ? (
                <div className="staff-app-message-attachments">
                  {message.attachments.map((attachment) => {
                    const isImage = attachment.mimeType
                      .trim()
                      .toLowerCase()
                      .startsWith("image/");

                    return (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`staff-app-message-attachment ${
                          isImage ? "image" : "file"
                        }`}
                      >
                        {isImage ? (
                          <img src={attachment.url} alt={attachment.fileName} />
                        ) : (
                          <span className="staff-app-message-attachment-icon">
                            {(attachment.extension || "file").slice(0, 4).toUpperCase()}
                          </span>
                        )}
                        <span className="staff-app-message-attachment-label">
                          {attachment.fileName}
                        </span>
                      </a>
                    );
                  })}
                </div>
              ) : null}
              <span>{formatStaffAppTimestamp(message.sentAt)}</span>
            </article>
          ))}
        </div>
      )}

      {thread.allowReplies === false ? (
        <div className="staff-app-inline-note">
          Staff cannot reply in this thread, but SCM can keep sending updates here.
        </div>
      ) : null}

      <form
        action={sendScmGigConversationReplyAction}
        className="staff-app-form-card"
        encType="multipart/form-data"
      >
        <input type="hidden" name="gigId" value={gigId} />
        <input type="hidden" name="threadId" value={thread.id} />
        <input type="hidden" name="returnTo" value={`${livePath}/messages/${thread.id}`} />
        <label className="staff-app-form-field">
          <span>Reply</span>
          <textarea
            name="body"
            placeholder="Continue the conversation here."
          />
        </label>
        <label className="staff-app-form-field">
          <span>Attachments</span>
          <input
            type="file"
            name="attachment"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt,.msg"
          />
        </label>
        <button type="submit" className="staff-app-button">
          Send update
        </button>
      </form>
    </section>
  );
}
