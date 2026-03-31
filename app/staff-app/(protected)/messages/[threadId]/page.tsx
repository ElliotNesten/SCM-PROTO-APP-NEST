import Link from "next/link";
import { notFound } from "next/navigation";

import { sendStaffAppMessageReply } from "@/app/staff-app/actions";
import {
  formatStaffAppCompactDate,
  formatStaffAppTimestamp,
  getStaffAppMessageThreadById,
} from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppMessageThreadPageProps = {
  params: Promise<{ threadId: string }>;
};

export default async function StaffAppMessageThreadPage({
  params,
}: StaffAppMessageThreadPageProps) {
  const { threadId } = await params;
  const account = await requireCurrentStaffAppAccount();
  const thread = await getStaffAppMessageThreadById(threadId, account);
  const latestMessage = thread?.messages.at(-1);
  const repliesEnabled =
    thread?.messages.length > 0 && latestMessage?.allowReplies !== false;

  if (!thread) {
    notFound();
  }

  return (
    <section className="staff-app-screen">
      <Link href="/staff-app/messages" className="staff-app-back-link">
        Back to messages
      </Link>

      <div className="staff-app-card emphasis">
        <p className="staff-app-kicker">{thread.shiftTitle}</p>
        <h1>{thread.eventName}</h1>
        <p className="staff-app-muted">
          {thread.venue} | {formatStaffAppCompactDate(thread.date)}
        </p>
        <div className="staff-app-chip-row">
          <span className="staff-app-chip">{thread.contactPerson}</span>
          <span className="staff-app-chip">
            {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}
          </span>
          {latestMessage?.allowReplies === false ? (
            <span className="staff-app-chip warning">Replies off</span>
          ) : null}
        </div>
      </div>

      {thread.messages.length === 0 ? (
        <div className="staff-app-empty-state">
          No shift communication has been sent to this thread yet.
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
                          <img
                            src={attachment.url}
                            alt={attachment.fileName}
                          />
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
              {message.allowReplies === false ? (
                <small className="staff-app-message-reply-note">
                  Broadcast only. Replies are turned off for this update.
                </small>
              ) : null}
              <span>{formatStaffAppTimestamp(message.sentAt)}</span>
            </article>
          ))}
        </div>
      )}

      {repliesEnabled ? (
        <form
          action={sendStaffAppMessageReply}
          className="staff-app-form-card"
          encType="multipart/form-data"
        >
          <input type="hidden" name="gigId" value={thread.gigId} />
          <input type="hidden" name="threadId" value={thread.id} />
          <input type="hidden" name="returnTo" value={`/staff-app/messages/${thread.id}`} />
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
            Send reply
          </button>
        </form>
      ) : (
        <div className="staff-app-inline-note">
          {thread.messages.length === 0
            ? "This thread has not been opened yet, so replies are not available."
            : "Replies are turned off for this thread."}
        </div>
      )}
    </section>
  );
}
