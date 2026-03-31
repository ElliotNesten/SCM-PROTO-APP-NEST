import type { ShiftCommunicationState, ShiftMessageAuthorType } from "@/types/scm";
import {
  isAllowedShiftMessageAttachment,
  storeShiftMessageAttachments,
} from "@/lib/shift-communication-attachments";
import {
  createStoredShiftMessage,
  getStoredShiftCommunicationThreadById,
} from "@/lib/shift-communication-store";

type AppendShiftCommunicationReplyInput = {
  gigId: string;
  threadId: string;
  body: string;
  attachments?: File[];
  authorName: string;
  authorProfileId?: string;
  authorType: ShiftMessageAuthorType;
};

export async function appendReplyToShiftCommunicationThread(
  input: AppendShiftCommunicationReplyInput,
): Promise<{
  state: ShiftCommunicationState;
  allowReplies: boolean;
}> {
  const thread = await getStoredShiftCommunicationThreadById(input.gigId, input.threadId);

  if (!thread) {
    throw new Error("Conversation not found.");
  }

  const body = input.body.trim();
  const attachments = input.attachments ?? [];

  if (!body && attachments.length === 0) {
    throw new Error("Write a reply or add at least one attachment first.");
  }

  const invalidUpload = attachments.find(
    (attachment) => !isAllowedShiftMessageAttachment(attachment),
  );

  if (invalidUpload) {
    throw new Error(
      "Only PDF, common office files, and image attachments are supported for shift communication.",
    );
  }

  const storedAttachments = await storeShiftMessageAttachments(input.gigId, attachments);
  const state = await createStoredShiftMessage(input.gigId, {
    audience: thread.target.audience,
    audienceLabel: thread.target.audienceLabel,
    recipientIds: thread.target.recipientIds,
    shiftId: thread.target.shiftId,
    groupId: thread.target.groupId,
    threadId: thread.target.id,
    body,
    allowReplies: thread.target.allowReplies,
    attachments: storedAttachments,
    authorName: input.authorName,
    authorProfileId: input.authorProfileId,
    authorType: input.authorType,
  });

  return {
    state,
    allowReplies: thread.target.allowReplies,
  };
}
