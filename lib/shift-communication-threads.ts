import type { ShiftMessageAudience, ShiftMessageRecord } from "@/types/scm";

type ShiftCommunicationThreadSource = Pick<
  ShiftMessageRecord,
  | "id"
  | "gigId"
  | "audience"
  | "audienceLabel"
  | "recipientIds"
  | "shiftId"
  | "groupId"
  | "threadId"
  | "allowReplies"
  | "createdAt"
  | "body"
  | "attachments"
>;

export type ShiftCommunicationThreadTarget = {
  id: string;
  audience: ShiftMessageAudience;
  audienceLabel: string;
  recipientIds: string[];
  shiftId?: string;
  groupId?: string;
  allowReplies: boolean;
};

export type ShiftCommunicationThreadSummary<TMessage extends ShiftMessageRecord = ShiftMessageRecord> =
  ShiftCommunicationThreadTarget & {
    latestMessage: TMessage;
    lastActivityAt: string;
    messageCount: number;
    messages: TMessage[];
  };

function normalizeRecipientIds(recipientIds: string[]) {
  return Array.from(new Set(recipientIds.filter(Boolean)));
}

export function buildShiftCommunicationThreadId(
  message: Pick<
    ShiftCommunicationThreadSource,
    "id" | "gigId" | "audience" | "recipientIds" | "shiftId" | "groupId" | "threadId"
  >,
) {
  const existingThreadId = message.threadId?.trim();

  if (existingThreadId) {
    return existingThreadId;
  }

  if (message.audience === "bookedOnShift") {
    return message.shiftId?.trim()
      ? `thread__shift__${message.gigId}__${message.shiftId.trim()}`
      : `thread__audience__${message.gigId}__allBookedStaff`;
  }

  if (message.audience === "standLeaders") {
    return `thread__audience__${message.gigId}__standLeaders`;
  }

  if (message.audience === "customGroup" && message.groupId?.trim()) {
    return `thread__group__${message.gigId}__${message.groupId.trim()}`;
  }

  if (message.audience === "individualPeople") {
    const recipientIds = normalizeRecipientIds(message.recipientIds);

    if (recipientIds.length === 1) {
      return `thread__direct__${message.gigId}__${recipientIds[0]}`;
    }

    return `thread__team__${message.gigId}`;
  }

  return `thread__message__${message.id}`;
}

export function resolveShiftCommunicationThreadAllowReplies(
  message: Pick<ShiftCommunicationThreadSource, "audience" | "allowReplies">,
) {
  return typeof message.allowReplies === "boolean"
    ? message.allowReplies
    : message.audience !== "bookedOnShift";
}

export function buildShiftCommunicationThreadTarget(
  message: ShiftCommunicationThreadSource,
): ShiftCommunicationThreadTarget {
  return {
    id: buildShiftCommunicationThreadId(message),
    audience: message.audience,
    audienceLabel: message.audienceLabel?.trim() || "Shift communication",
    recipientIds: normalizeRecipientIds(message.recipientIds),
    shiftId: message.shiftId?.trim() || undefined,
    groupId: message.groupId?.trim() || undefined,
    allowReplies: resolveShiftCommunicationThreadAllowReplies(message),
  };
}

export function buildShiftCommunicationMessagePreview(
  message: Pick<ShiftCommunicationThreadSource, "body" | "attachments">,
) {
  const trimmedBody = message.body.trim();

  if (trimmedBody) {
    return trimmedBody;
  }

  const attachmentCount = message.attachments?.length ?? 0;

  if (attachmentCount === 1) {
    return `Attachment: ${message.attachments?.[0]?.fileName ?? "1 file"}`;
  }

  if (attachmentCount > 1) {
    return `${attachmentCount} attachments`;
  }

  return "No message text";
}

export function buildShiftCommunicationThreadSummaries<
  TMessage extends ShiftMessageRecord,
>(messages: TMessage[]) {
  const messagesByThreadId = new Map<string, TMessage[]>();

  for (const message of messages) {
    const threadId = buildShiftCommunicationThreadId(message);
    const existingMessages = messagesByThreadId.get(threadId);

    if (existingMessages) {
      existingMessages.push(message);
      continue;
    }

    messagesByThreadId.set(threadId, [message]);
  }

  return [...messagesByThreadId.entries()]
    .map<ShiftCommunicationThreadSummary<TMessage>>(([, threadMessages]) => {
      const sortedMessages = [...threadMessages].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
      const latestMessage = sortedMessages.at(-1) ?? sortedMessages[0];

      if (!latestMessage) {
        throw new Error("Could not build a shift communication thread without messages.");
      }

      const target = buildShiftCommunicationThreadTarget(latestMessage);

      return {
        ...target,
        latestMessage,
        lastActivityAt: latestMessage.createdAt,
        messageCount: sortedMessages.length,
        messages: sortedMessages,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.lastActivityAt).getTime() -
        new Date(left.lastActivityAt).getTime(),
    );
}
