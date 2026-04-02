import Link from "next/link";

import { sendScmGigMessageAction } from "@/app/staff-app/(scm-protected)/scm/live/actions";
import { formatStaffAppTimestamp } from "@/lib/staff-app-data";
import type {
  StaffAppScmConversationThread,
  StaffAppScmGigWorkspace,
} from "@/lib/staff-app-scm-ops";

type MessageRecipientOption = {
  id: string;
  name: string;
  roleSummary: string;
  statusSummary: string;
  contactSummary: string;
  rank: number;
};

function getRecipientRank(
  entry: StaffAppScmGigWorkspace["roster"][number],
) {
  if (entry.bookingStatus === "Confirmed") {
    return 0;
  }

  if (entry.bookingStatus === "Pending") {
    return 1;
  }

  return 2;
}

function buildRecipientOptions(
  roster: StaffAppScmGigWorkspace["roster"],
) {
  const recipientById = new Map<
    string,
    {
      id: string;
      name: string;
      roleSet: Set<string>;
      statusSet: Set<string>;
      contactSummary: string;
      rank: number;
    }
  >();

  for (const entry of roster) {
    const existingRecipient = recipientById.get(entry.staffId);
    const nextContactSummary =
      entry.staffPhone || entry.staffEmail || "No contact info";

    if (existingRecipient) {
      existingRecipient.roleSet.add(entry.shiftRole);
      existingRecipient.statusSet.add(entry.statusLabel);
      existingRecipient.rank = Math.min(
        existingRecipient.rank,
        getRecipientRank(entry),
      );

      if (existingRecipient.contactSummary === "No contact info") {
        existingRecipient.contactSummary = nextContactSummary;
      }

      continue;
    }

    recipientById.set(entry.staffId, {
      id: entry.staffId,
      name: entry.staffName,
      roleSet: new Set([entry.shiftRole]),
      statusSet: new Set([entry.statusLabel]),
      contactSummary: nextContactSummary,
      rank: getRecipientRank(entry),
    });
  }

  return [...recipientById.values()]
    .map<MessageRecipientOption>((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      roleSummary: [...recipient.roleSet].join(", "),
      statusSummary: [...recipient.statusSet].join(" | "),
      contactSummary: recipient.contactSummary,
      rank: recipient.rank,
    }))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.name.localeCompare(right.name);
    });
}

function getAudienceThreadLabel(thread: StaffAppScmConversationThread) {
  if (thread.audience === "bookedOnShift" && !thread.shiftId) {
    return "Messages to all";
  }

  if (thread.audience === "standLeaders") {
    return "Stand leaders";
  }

  if (thread.audience === "customGroup") {
    return "Group chat";
  }

  if (thread.recipientCount === 1) {
    return "Direct chat";
  }

  return "Conversation";
}

function ConversationSummary({
  thread,
  livePath,
  emptyCopy,
}: {
  thread: StaffAppScmConversationThread | null;
  livePath: string;
  emptyCopy: string;
}) {
  if (!thread) {
    return <p className="staff-app-inline-note">{emptyCopy}</p>;
  }

  return (
    <div className="staff-app-scm-live-message-summary">
      <div className="staff-app-scm-live-message-summary-head">
        <div>
          <strong>{thread.title}</strong>
          <p>{thread.preview}</p>
        </div>
        <span className="staff-app-scm-status-pill">
          {thread.allowReplies ? "Replies on" : "Broadcast only"}
        </span>
      </div>

      <div className="staff-app-scm-live-message-summary-meta">
        <span>
          {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
        </span>
        <span>{thread.recipientCount} recipients</span>
        <span>{formatStaffAppTimestamp(thread.lastActivityAt)}</span>
      </div>

      <Link
        href={`${livePath}/messages/${thread.id}`}
        className="staff-app-inline-link"
      >
        Open full thread
      </Link>
    </div>
  );
}

export function ScmLiveMessagesPanel({
  gigId,
  livePath,
  activeComposer,
  isRosterOpen,
  roster,
  conversationThreads,
}: {
  gigId: string;
  livePath: string;
  activeComposer: "all" | "stand-leaders" | "new-chat" | null;
  isRosterOpen: boolean;
  roster: StaffAppScmGigWorkspace["roster"];
  conversationThreads: StaffAppScmConversationThread[];
}) {
  const recipientOptions = buildRecipientOptions(roster);
  const allBookedRecipientIds = Array.from(
    new Set(
      roster
        .filter((entry) => entry.bookingStatus === "Confirmed")
        .map((entry) => entry.staffId),
    ),
  );
  const standLeaderRecipientIds = Array.from(
    new Set(
      roster
        .filter((entry) => entry.bookingStatus === "Confirmed")
        .filter(
          (entry) => entry.shiftRole.trim().toLowerCase() === "stand leader",
        )
        .map((entry) => entry.staffId),
    ),
  );
  const allBookedThread =
    conversationThreads.find(
      (thread) => thread.audience === "bookedOnShift" && !thread.shiftId,
    ) ?? null;
  const standLeadersThread =
    conversationThreads.find((thread) => thread.audience === "standLeaders") ??
    null;
  const buildMessagePath = (chat: "all" | "stand-leaders" | "new-chat") => {
    const params = new URLSearchParams();
    params.set("chat", chat);

    if (isRosterOpen) {
      params.set("roster", "open");
    }

    return `${livePath}?${params.toString()}#messages`;
  };
  const allMessagesPath = buildMessagePath("all");
  const standLeadersPath = buildMessagePath("stand-leaders");
  const newChatPath = buildMessagePath("new-chat");

  return (
    <div className="staff-app-card staff-app-scm-live-messages-card" id="messages">
      <div className="staff-app-section-head compact">
        <div>
          <p className="staff-app-kicker">Messages</p>
          <h2>Gig communication</h2>
        </div>
      </div>

      <div className="staff-app-scm-live-message-actions">
        <Link
          href={allMessagesPath}
          className={`staff-app-button compact${activeComposer === "all" ? "" : " secondary"}`}
        >
          Messages to all
        </Link>
        <Link
          href={standLeadersPath}
          className={`staff-app-button compact${activeComposer === "stand-leaders" ? "" : " secondary"}`}
        >
          Stand leaders
        </Link>
        <Link
          href={newChatPath}
          className={`staff-app-button compact${activeComposer === "new-chat" ? "" : " secondary"}`}
        >
          New chat
        </Link>
      </div>

      {activeComposer === "all" ? (
        <section className="staff-app-scm-live-message-section">
          <div className="staff-app-scm-live-message-section-head">
            <div>
              <h3>Message to all</h3>
            </div>
            <span className="staff-app-scm-status-pill">
              {allBookedRecipientIds.length} recipients
            </span>
          </div>

          <ConversationSummary
            thread={allBookedThread}
            livePath={livePath}
            emptyCopy="No shared all-staff thread has been started yet. Your first message will open it."
          />

          <form action={sendScmGigMessageAction} className="staff-app-form-card staff-app-scm-live-message-form">
            <input type="hidden" name="gigId" value={gigId} />
            <input type="hidden" name="messageMode" value="allBooked" />
            <input type="hidden" name="returnTo" value={allMessagesPath} />
            <label className="staff-app-form-field">
              <span>Message</span>
              <textarea
                name="body"
                placeholder="Doors moved to 16:30. Please report to Gate B and check in with the stand lead."
                required
              />
            </label>
            <button
              type="submit"
              className="staff-app-button"
              disabled={allBookedRecipientIds.length === 0}
            >
              Send to all booked staff
            </button>
          </form>
        </section>
      ) : null}

      {activeComposer === "stand-leaders" ? (
        <section className="staff-app-scm-live-message-section">
          <div className="staff-app-scm-live-message-section-head">
            <div>
              <h3>Stand leaders</h3>
            </div>
            <span className="staff-app-scm-status-pill">
              {standLeaderRecipientIds.length} recipients
            </span>
          </div>

          <ConversationSummary
            thread={standLeadersThread}
            livePath={livePath}
            emptyCopy="No stand leader thread has been started yet. Your first message will open it."
          />

          <form action={sendScmGigMessageAction} className="staff-app-form-card staff-app-scm-live-message-form">
            <input type="hidden" name="gigId" value={gigId} />
            <input type="hidden" name="messageMode" value="standLeaders" />
            <input type="hidden" name="returnTo" value={standLeadersPath} />
            <label className="staff-app-form-field">
              <span>Message</span>
              <textarea
                name="body"
                placeholder="Stand leaders: please collect your float bags and confirm that your team is in position."
                required
              />
            </label>
            <button
              type="submit"
              className="staff-app-button"
              disabled={standLeaderRecipientIds.length === 0}
            >
              Send to stand leaders
            </button>
          </form>
        </section>
      ) : null}

      {activeComposer === "new-chat" ? (
        <section className="staff-app-scm-live-message-section">
          <div className="staff-app-scm-live-message-section-head">
            <div>
              <h3>New chat</h3>
            </div>
          </div>

          {recipientOptions.length === 0 ? (
            <p className="staff-app-empty-state">
              No people are linked to this gig yet, so new chats cannot be created.
            </p>
          ) : (
            <div className="staff-app-scm-live-new-chat-grid">
              <form
                action={sendScmGigMessageAction}
                className="staff-app-form-card staff-app-scm-live-compose-card"
              >
                <input type="hidden" name="gigId" value={gigId} />
                <input type="hidden" name="messageMode" value="direct" />
                <input type="hidden" name="returnTo" value={newChatPath} />

                <div className="staff-app-scm-live-compose-card-head">
                  <div>
                    <strong>Direct chat</strong>
                  </div>
                </div>

                <label className="staff-app-form-field">
                  <span>Choose person</span>
                  <select name="recipientId" defaultValue={recipientOptions[0]?.id ?? ""} required>
                    {recipientOptions.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>
                        {recipient.name} - {recipient.roleSummary}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="staff-app-form-field">
                  <span>Message</span>
                  <textarea
                    name="body"
                    placeholder="Hi, can you confirm your arrival time for the gig?"
                    required
                  />
                </label>

                <button type="submit" className="staff-app-button">
                  Start direct chat
                </button>
              </form>

              <form
                action={sendScmGigMessageAction}
                className="staff-app-form-card staff-app-scm-live-compose-card"
              >
                <input type="hidden" name="gigId" value={gigId} />
                <input type="hidden" name="messageMode" value="group" />
                <input type="hidden" name="returnTo" value={newChatPath} />

                <div className="staff-app-scm-live-compose-card-head">
                  <div>
                    <strong>Group chat</strong>
                  </div>
                </div>

                <label className="staff-app-form-field">
                  <span>Group name</span>
                  <input
                    name="groupName"
                    type="text"
                    placeholder="Example: Floor sellers"
                    required
                  />
                </label>

                <div className="staff-app-scm-live-recipient-grid">
                  {recipientOptions.map((recipient) => (
                    <label
                      key={recipient.id}
                      className="staff-app-scm-live-recipient-option"
                    >
                      <input type="checkbox" name="memberIds" value={recipient.id} />
                      <span className="staff-app-scm-live-recipient-option-copy">
                        <strong>{recipient.name}</strong>
                        <small>{recipient.roleSummary}</small>
                        <small>{recipient.statusSummary}</small>
                        <small>{recipient.contactSummary}</small>
                      </span>
                    </label>
                  ))}
                </div>

                <label className="staff-app-form-field">
                  <span>Message</span>
                  <textarea
                    name="body"
                    placeholder="This chat is for the floor team. Use it for updates during the shift."
                    required
                  />
                </label>

                <button type="submit" className="staff-app-button">
                  Create group chat
                </button>
              </form>
            </div>
          )}
        </section>
      ) : null}

      <div className="staff-app-scm-live-message-list-head">
        <div>
          <p className="staff-app-kicker">Ongoing conversations</p>
          <h3>Open and continue chats</h3>
          <p className="staff-app-scm-live-message-section-copy">
            Every thread below opens the full chat history with attachments and reply box.
          </p>
        </div>
      </div>

      <div className="staff-app-scm-live-message-list">
        {conversationThreads.length === 0 ? (
          <p className="staff-app-empty-state">
            No conversations have been opened for this gig yet.
          </p>
        ) : (
          conversationThreads.map((thread) => (
            <Link
              key={thread.id}
              href={`${livePath}/messages/${thread.id}`}
              className="staff-app-scm-live-message-card"
            >
              <div className="staff-app-scm-live-message-card-head">
                <div>
                  <p className="staff-app-kicker">
                    {getAudienceThreadLabel(thread)}
                  </p>
                  <strong>{thread.title}</strong>
                </div>
                <span className="staff-app-scm-status-pill">
                  {thread.allowReplies ? "Replies on" : "Broadcast only"}
                </span>
              </div>

              <p>{thread.preview}</p>

              <div className="staff-app-scm-live-message-meta">
                <span>
                  {thread.messageCount} message
                  {thread.messageCount === 1 ? "" : "s"}
                </span>
                <span>{thread.recipientCount} recipients</span>
                <span>{formatStaffAppTimestamp(thread.lastActivityAt)}</span>
                <span className="staff-app-scm-live-message-link-copy">
                  Open chat
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
