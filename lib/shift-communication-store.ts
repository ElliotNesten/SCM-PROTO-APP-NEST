import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  ShiftCommunicationState,
  ShiftMessageAttachment,
  ShiftMessageAudience,
  ShiftMessageAuthorType,
  ShiftMessageGroup,
  ShiftMessageRecord,
} from "@/types/scm";
import { buildShiftMessageAttachmentFileUrl } from "@/lib/shift-communication-attachment-storage";
import {
  buildShiftCommunicationThreadId,
  buildShiftCommunicationThreadTarget,
  resolveShiftCommunicationThreadAllowReplies,
} from "@/lib/shift-communication-threads";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "shift-communication-store.json");

type ShiftCommunicationStore = Record<string, ShiftCommunicationState>;

type CreateShiftMessageInput = {
  audience: ShiftMessageAudience;
  audienceLabel: string;
  recipientIds: string[];
  body: string;
  shiftId?: string;
  groupId?: string;
  threadId?: string;
  authorName?: string;
  authorProfileId?: string;
  authorType?: ShiftMessageAuthorType;
  allowReplies?: boolean;
  attachments?: ShiftMessageAttachment[];
};

type CreateShiftMessageGroupInput = {
  name: string;
  memberIds: string[];
};

function createEmptyState(gigId: string): ShiftCommunicationState {
  return {
    gigId,
    customGroups: [],
    messages: [],
  };
}

function normalizeShiftMessageAttachment(
  gigId: string,
  attachment: ShiftMessageAttachment,
): ShiftMessageAttachment {
  return {
    id: attachment.id,
    fileName: attachment.fileName?.trim() || "Attachment",
    fileSize: Number.isFinite(attachment.fileSize) ? attachment.fileSize : 0,
    uploadedAt: attachment.uploadedAt || new Date(0).toISOString(),
    mimeType: attachment.mimeType?.trim() || "application/octet-stream",
    extension: attachment.extension?.trim().toLowerCase() || "",
    url:
      attachment.url?.trim() ||
      buildShiftMessageAttachmentFileUrl(gigId, attachment.id),
    storagePath: attachment.storagePath?.trim() || "",
  };
}

function normalizeShiftMessageRecord(
  gigId: string,
  message: ShiftMessageRecord,
): ShiftMessageRecord {
  const normalizedRecipientIds = Array.isArray(message.recipientIds)
    ? message.recipientIds.filter(Boolean)
    : [];
  const normalizedShiftId = message.shiftId?.trim() || undefined;
  const normalizedGroupId = message.groupId?.trim() || undefined;
  const normalizedAuthorType = message.authorType === "staff" ? "staff" : "scm";

  return {
    id: message.id,
    gigId,
    audience: message.audience,
    audienceLabel: message.audienceLabel?.trim() || "Shift communication",
    recipientIds: normalizedRecipientIds,
    shiftId: normalizedShiftId,
    groupId: normalizedGroupId,
    threadId: buildShiftCommunicationThreadId({
      id: message.id,
      gigId,
      audience: message.audience,
      recipientIds: normalizedRecipientIds,
      shiftId: normalizedShiftId,
      groupId: normalizedGroupId,
      threadId: message.threadId,
    }),
    body: typeof message.body === "string" ? message.body.trim() : "",
    createdAt: message.createdAt || new Date(0).toISOString(),
    authorName: message.authorName?.trim() || undefined,
    authorProfileId: message.authorProfileId?.trim() || undefined,
    authorType: normalizedAuthorType,
    allowReplies: resolveShiftCommunicationThreadAllowReplies(message),
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map((attachment) =>
          normalizeShiftMessageAttachment(gigId, attachment),
        )
      : [],
  };
}

function normalizeShiftCommunicationState(
  gigId: string,
  state: ShiftCommunicationState | undefined,
): ShiftCommunicationState {
  if (!state) {
    return createEmptyState(gigId);
  }

  return {
    gigId,
    customGroups: Array.isArray(state.customGroups) ? state.customGroups : [],
    messages: Array.isArray(state.messages)
      ? state.messages.map((message) => normalizeShiftMessageRecord(gigId, message))
      : [],
  };
}

async function ensureCommunicationStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify({}, null, 2), "utf8");
  }
}

async function readCommunicationStore() {
  await ensureCommunicationStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as ShiftCommunicationStore;

  return Object.fromEntries(
    Object.entries(parsed).map(([gigId, state]) => [
      gigId,
      normalizeShiftCommunicationState(gigId, state),
    ]),
  ) as ShiftCommunicationStore;
}

async function writeCommunicationStore(store: ShiftCommunicationStore) {
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function getStoredShiftCommunication(gigId: string) {
  const store = await readCommunicationStore();
  return store[gigId] ?? createEmptyState(gigId);
}

export async function getAllStoredShiftCommunicationStates() {
  return readCommunicationStore();
}

export async function createStoredShiftMessage(
  gigId: string,
  input: CreateShiftMessageInput,
) {
  const store = await readCommunicationStore();
  const currentState = store[gigId] ?? createEmptyState(gigId);
  const createdMessageId = `shift-message-${randomUUID().slice(0, 8)}`;

  const createdMessage: ShiftMessageRecord = {
    id: createdMessageId,
    gigId,
    audience: input.audience,
    audienceLabel: input.audienceLabel,
    recipientIds: [...input.recipientIds],
    shiftId: input.shiftId,
    groupId: input.groupId,
    threadId: buildShiftCommunicationThreadId({
      id: createdMessageId,
      gigId,
      audience: input.audience,
      recipientIds: input.recipientIds,
      shiftId: input.shiftId,
      groupId: input.groupId,
      threadId: input.threadId,
    }),
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
    authorName: input.authorName?.trim() || undefined,
    authorProfileId: input.authorProfileId?.trim() || undefined,
    authorType: input.authorType === "staff" ? "staff" : "scm",
    allowReplies: resolveShiftCommunicationThreadAllowReplies({
      audience: input.audience,
      allowReplies: input.allowReplies,
    }),
    attachments: (input.attachments ?? []).map((attachment) =>
      normalizeShiftMessageAttachment(gigId, attachment),
    ),
  };

  const nextState: ShiftCommunicationState = {
    ...currentState,
    messages: [createdMessage, ...currentState.messages],
  };

  store[gigId] = nextState;
  await writeCommunicationStore(store);

  return nextState;
}

export async function createStoredShiftMessageGroup(
  gigId: string,
  input: CreateShiftMessageGroupInput,
) {
  const store = await readCommunicationStore();
  const currentState = store[gigId] ?? createEmptyState(gigId);

  const createdGroup: ShiftMessageGroup = {
    id: `shift-group-${randomUUID().slice(0, 8)}`,
    gigId,
    name: input.name.trim(),
    memberIds: [...input.memberIds],
    createdAt: new Date().toISOString(),
  };

  const nextState: ShiftCommunicationState = {
    ...currentState,
    customGroups: [createdGroup, ...currentState.customGroups],
  };

  store[gigId] = nextState;
  await writeCommunicationStore(store);

  return nextState;
}

export async function deleteStoredShiftCommunication(gigId: string) {
  const store = await readCommunicationStore();

  if (!(gigId in store)) {
    return false;
  }

  delete store[gigId];
  await writeCommunicationStore(store);
  return true;
}

export async function getStoredShiftMessageAttachmentById(
  gigId: string,
  attachmentId: string,
) {
  const state = await getStoredShiftCommunication(gigId);

  for (const message of state.messages) {
    const attachment = (message.attachments ?? []).find(
      (entry) => entry.id === attachmentId,
    );

    if (attachment) {
      return {
        message,
        attachment,
      };
    }
  }

  return null;
}

export async function getStoredShiftMessagesForThread(
  gigId: string,
  threadId: string,
) {
  const state = await getStoredShiftCommunication(gigId);

  return state.messages
    .filter(
      (message) =>
        (message.threadId || buildShiftCommunicationThreadId(message)) === threadId,
    )
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
}

export async function getStoredShiftCommunicationThreadById(
  gigId: string,
  threadId: string,
) {
  const messages = await getStoredShiftMessagesForThread(gigId, threadId);
  const latestMessage = messages.at(-1);

  if (!latestMessage) {
    return null;
  }

  return {
    target: buildShiftCommunicationThreadTarget(latestMessage),
    latestMessage,
    messages,
  };
}
