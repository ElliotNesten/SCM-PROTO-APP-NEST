"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { DetailTabs } from "@/components/detail-tabs";
import { ShiftCard } from "@/components/shift-card";
import { StatusBadge } from "@/components/status-badge";
import { shiftTabs } from "@/data/scm-data";
import {
  buildShiftCommunicationMessagePreview,
  buildShiftCommunicationThreadSummaries,
} from "@/lib/shift-communication-threads";
import type {
  BookingStatus,
  Shift,
  ShiftCommunicationState,
  ShiftMessageAudience,
  ShiftMessageRecord,
} from "@/types/scm";

type ShiftRoleOption = "Stand Leader" | "Seller" | "Runner" | "Other";

type NewShiftFormState = {
  role: ShiftRoleOption;
  customRole: string;
  priorityLevel: string;
  requiredStaff: string;
  startTime: string;
  endTime: string;
};

type BookingCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  region: string;
  country: string;
  roles: string[];
  approvalStatus: string;
};

type ShiftCandidatePool = {
  shiftId: string;
  candidates: BookingCandidate[];
};

type GigShiftHubTab =
  | "overview"
  | "booking"
  | "waitlist"
  | "messages";

type GigShiftPanelProps = {
  gigId: string;
  shifts: Shift[];
  canCreateShifts: boolean;
  shiftCreationMessage: string | null;
  activeTab: GigShiftHubTab;
  candidatePools: ShiftCandidatePool[];
  staffProfiles: BookingCandidate[];
  initialCommunication: ShiftCommunicationState;
};

function buildInitialShiftForm(seedShift?: Shift): NewShiftFormState {
  const seededRole = seedShift?.role;
  const isDefaultRole =
    seededRole === "Stand Leader" ||
    seededRole === "Seller" ||
    seededRole === "Runner";

  return {
    role: seededRole ? (isDefaultRole ? seededRole : "Other") : "Stand Leader",
    customRole: isDefaultRole ? "" : seededRole ?? "",
    priorityLevel: String(seedShift?.priorityLevel ?? 1),
    requiredStaff: String(seedShift?.requiredStaff ?? 1),
    startTime: seedShift?.startTime ?? "16:00",
    endTime: seedShift?.endTime ?? "23:00",
  };
}

function getConfirmedCountForShift(shift: Shift) {
  return shift.assignments.filter(
    (assignment) => assignment.bookingStatus === "Confirmed",
  ).length;
}

function getWaitlistCountForShift(shift: Shift) {
  return shift.assignments.filter(
    (assignment) => assignment.bookingStatus === "Waitlisted",
  ).length;
}

function getOpenSlotsForShift(shift: Shift) {
  return Math.max(shift.requiredStaff - getConfirmedCountForShift(shift), 0);
}

type ShiftAssignmentLocation = {
  shift: Shift;
  bookingStatus: BookingStatus;
};

type MessageRecipientStatus = BookingStatus | "Unassigned";

type MessageRecipient = BookingCandidate & {
  messageStatus: MessageRecipientStatus;
};

type MessageRecipientSection = {
  key: MessageRecipientStatus;
  label: string;
  helperText: string;
  optionLabel: string;
  badgeLabel: string;
  badgeTone: "info" | "success" | "warn" | "danger";
  summaryLabel: string;
  people: MessageRecipient[];
};

type MessageRecipientSectionMeta = Omit<MessageRecipientSection, "key" | "people">;

type MessageConversationThread = {
  id: string;
  audience: ShiftMessageAudience;
  audienceLabel: string;
  recipientIds: string[];
  shiftId?: string;
  groupId?: string;
  allowReplies: boolean;
  latestMessage: ShiftMessageRecord;
  lastActivityAt: string;
  messageCount: number;
  messages: ShiftMessageRecord[];
  title: string;
  preview: string;
  recipients: MessageRecipient[];
  recipientSections: MessageRecipientSection[];
};

const bookingStatusPriority: Record<BookingStatus, number> = {
  Confirmed: 3,
  Waitlisted: 2,
  Pending: 1,
};

const messageAttachmentAccept =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt,.msg";

const messageRecipientStatusOrder: MessageRecipientStatus[] = [
  "Confirmed",
  "Waitlisted",
  "Pending",
  "Unassigned",
];

const messageRecipientSectionMeta: Record<
  MessageRecipientStatus,
  MessageRecipientSectionMeta
> = {
  Confirmed: {
    label: "Booked staff",
    helperText: "Confirmed on a shift and safe to contact as booked personnel.",
    optionLabel: "Booked",
    badgeLabel: "Booked",
    badgeTone: "success",
    summaryLabel: "booked",
  },
  Waitlisted: {
    label: "Waitlist",
    helperText: "Not booked yet. Review carefully before saving or sending.",
    optionLabel: "Waitlist",
    badgeLabel: "Waitlist",
    badgeTone: "warn",
    summaryLabel: "waitlist",
  },
  Pending: {
    label: "Pending confirmation",
    helperText: "Still pending and not confirmed as booked staff.",
    optionLabel: "Pending",
    badgeLabel: "Pending",
    badgeTone: "info",
    summaryLabel: "pending",
  },
  Unassigned: {
    label: "No current booking",
    helperText: "Saved group members who are no longer assigned to this gig.",
    optionLabel: "Not booked",
    badgeLabel: "Not booked",
    badgeTone: "danger",
    summaryLabel: "not booked",
  },
};

function sortPeopleByName<T extends { firstName: string; lastName: string }>(people: T[]) {
  return [...people].sort((left, right) =>
    `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`),
  );
}

function resolvePreferredBookingStatus(
  currentStatus: BookingStatus | undefined,
  nextStatus: BookingStatus,
) {
  if (!currentStatus) {
    return nextStatus;
  }

  return bookingStatusPriority[nextStatus] > bookingStatusPriority[currentStatus]
    ? nextStatus
    : currentStatus;
}

function buildMessageRecipient(
  person: BookingCandidate,
  messageStatus: MessageRecipientStatus,
): MessageRecipient {
  return {
    ...person,
    messageStatus,
  };
}

function buildMessageRecipientSections(
  recipients: MessageRecipient[],
): MessageRecipientSection[] {
  return messageRecipientStatusOrder.flatMap((status) => {
    const people = sortPeopleByName(
      recipients.filter((person) => person.messageStatus === status),
    );

    if (people.length === 0) {
      return [];
    }

    return [
      {
        key: status,
        ...messageRecipientSectionMeta[status],
        people,
      },
    ];
  });
}

function resolveMessageRecipientsFromIds(
  memberIds: string[],
  messageRecipientsById: Map<string, MessageRecipient>,
  staffById: Map<string, BookingCandidate>,
) {
  return sortPeopleByName(
    memberIds
      .map((staffId) => {
        const existingRecipient = messageRecipientsById.get(staffId);

        if (existingRecipient) {
          return existingRecipient;
        }

        const person = staffById.get(staffId);
        return person ? buildMessageRecipient(person, "Unassigned") : null;
      })
      .filter((person): person is MessageRecipient => Boolean(person)),
  );
}

function formatMessageRecipientSummary(sections: MessageRecipientSection[]) {
  return sections
    .map((section) => `${section.people.length} ${section.summaryLabel}`)
    .join(" | ");
}

function formatFileSize(fileSize: number) {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return "0 B";
  }

  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(fileSize < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(fileSize < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function buildMessageAttachmentSignature(
  file: Pick<File, "name" | "size" | "lastModified">,
) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function mergeSelectedMessageAttachments(current: File[], incoming: File[]) {
  const knownSignatures = new Set(current.map(buildMessageAttachmentSignature));
  const merged = [...current];

  for (const file of incoming) {
    const signature = buildMessageAttachmentSignature(file);

    if (knownSignatures.has(signature)) {
      continue;
    }

    knownSignatures.add(signature);
    merged.push(file);
  }

  return merged;
}

export function GigShiftsPanel({
  gigId,
  shifts,
  canCreateShifts,
  shiftCreationMessage,
  activeTab,
  candidatePools,
  staffProfiles,
  initialCommunication,
}: GigShiftPanelProps) {
  const router = useRouter();
  const [shiftItems, setShiftItems] = useState(shifts);
  const [communicationState, setCommunicationState] =
    useState(initialCommunication);
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [newShiftForm, setNewShiftForm] = useState<NewShiftFormState>(() =>
    buildInitialShiftForm(shifts[0]),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [shiftPendingDelete, setShiftPendingDelete] = useState<Shift | null>(null);
  const [deleteShiftError, setDeleteShiftError] = useState<string | null>(null);
  const [isDeletingShift, setIsDeletingShift] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [pendingBookingKey, setPendingBookingKey] = useState<string | null>(null);
  const [bookingShiftExpansion, setBookingShiftExpansion] = useState<
    Record<string, boolean>
  >({});
  const [waitlistShiftExpansion, setWaitlistShiftExpansion] = useState<
    Record<string, boolean>
  >({});
  const [messageAudience, setMessageAudience] =
    useState<ShiftMessageAudience>("bookedOnShift");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageAttachments, setMessageAttachments] = useState<File[]>([]);
  const [messageAttachmentInputKey, setMessageAttachmentInputKey] = useState(0);
  const [activeMessageThreadId, setActiveMessageThreadId] = useState<string | null>(
    null,
  );
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  useEffect(() => {
    setShiftItems(shifts);
  }, [shifts]);

  useEffect(() => {
    setCommunicationState(initialCommunication);
  }, [initialCommunication]);

  useEffect(() => {
    setBookingShiftExpansion((current) => {
      const next: Record<string, boolean> = {};

      for (const shift of shiftItems) {
        next[shift.id] =
          current[shift.id] ?? (getOpenSlotsForShift(shift) > 0);
      }

      return next;
    });
  }, [shiftItems]);

  useEffect(() => {
    setWaitlistShiftExpansion((current) => {
      const next: Record<string, boolean> = {};

      for (const shift of shiftItems) {
        next[shift.id] = current[shift.id] ?? false;
      }

      return next;
    });
  }, [shiftItems]);

  const firstShift = shiftItems[0];
  const candidatePoolByShift = useMemo(
    () => new Map(candidatePools.map((pool) => [pool.shiftId, pool.candidates])),
    [candidatePools],
  );
  const bookingShiftItems = useMemo(
    () =>
      [...shiftItems].sort((left, right) => {
        const leftHasOpenSlots = getOpenSlotsForShift(left) > 0;
        const rightHasOpenSlots = getOpenSlotsForShift(right) > 0;

        if (leftHasOpenSlots === rightHasOpenSlots) {
          return 0;
        }

        return leftHasOpenSlots ? -1 : 1;
      }),
    [shiftItems],
  );
  const bookingCoverage = useMemo(() => {
    const totalRequiredSlots = shiftItems.reduce(
      (total, shift) => total + shift.requiredStaff,
      0,
    );
    const totalBookedSlots = shiftItems.reduce(
      (total, shift) =>
        total + Math.min(getConfirmedCountForShift(shift), shift.requiredStaff),
      0,
    );
    const totalOpenSlots = shiftItems.reduce(
      (total, shift) => total + getOpenSlotsForShift(shift),
      0,
    );
    const totalWaitlistCount = shiftItems.reduce(
      (total, shift) => total + getWaitlistCountForShift(shift),
      0,
    );
    const fullyBookedShiftCount = shiftItems.filter(
      (shift) => shift.requiredStaff > 0 && getOpenSlotsForShift(shift) === 0,
    ).length;
    const percentBooked =
      totalRequiredSlots === 0
        ? 0
        : Math.min(Math.round((totalBookedSlots / totalRequiredSlots) * 100), 100);

    return {
      totalRequiredSlots,
      totalBookedSlots,
      totalOpenSlots,
      totalWaitlistCount,
      fullyBookedShiftCount,
      percentBooked,
    };
  }, [shiftItems]);
  const waitlistedShiftItems = useMemo(
    () => shiftItems.filter((shift) => getWaitlistCountForShift(shift) > 0),
    [shiftItems],
  );
  const staffById = useMemo(
    () => new Map(staffProfiles.map((person) => [person.id, person])),
    [staffProfiles],
  );
  const messageStatusByStaffId = useMemo(() => {
    const statusByStaffId = new Map<string, BookingStatus>();

    for (const shift of shiftItems) {
      for (const assignment of shift.assignments) {
        statusByStaffId.set(
          assignment.staffId,
          resolvePreferredBookingStatus(
            statusByStaffId.get(assignment.staffId),
            assignment.bookingStatus,
          ),
        );
      }
    }

    return statusByStaffId;
  }, [shiftItems]);
  const messageRecipientsById = useMemo(() => {
    const recipients = new Map<string, MessageRecipient>();

    for (const [staffId, messageStatus] of messageStatusByStaffId) {
      const person = staffById.get(staffId);

      if (person) {
        recipients.set(staffId, buildMessageRecipient(person, messageStatus));
      }
    }

    return recipients;
  }, [messageStatusByStaffId, staffById]);
  const messageSelectableSections = useMemo(
    () => buildMessageRecipientSections([...messageRecipientsById.values()]),
    [messageRecipientsById],
  );
  const messageSelectablePeople = useMemo(
    () => messageSelectableSections.flatMap((section) => section.people),
    [messageSelectableSections],
  );
  const allBookedMessageRecipients = useMemo(
    () =>
      sortPeopleByName(
        [...messageRecipientsById.values()].filter(
          (person) => person.messageStatus === "Confirmed",
        ),
      ),
    [messageRecipientsById],
  );
  const standLeaderRecipients = useMemo(() => {
    const recipientIds = new Set(
      shiftItems
        .filter((shift) => shift.role === "Stand Leader")
        .flatMap((shift) =>
          shift.assignments
            .filter((assignment) => assignment.bookingStatus === "Confirmed")
            .map((assignment) => assignment.staffId),
        ),
    );

    return sortPeopleByName(
      [...recipientIds]
        .map((staffId) => staffById.get(staffId))
        .filter((person): person is BookingCandidate => Boolean(person)),
    );
  }, [shiftItems, staffById]);
  useEffect(() => {
    setSelectedPersonId((current) => {
      if (
        current &&
        messageSelectablePeople.some((person) => person.id === current)
      ) {
        return current;
      }

      return messageSelectablePeople[0]?.id ?? "";
    });
  }, [messageSelectablePeople]);

  useEffect(() => {
    setSelectedGroupId((current) => {
      if (
        current &&
        communicationState.customGroups.some((group) => group.id === current)
      ) {
        return current;
      }

      return communicationState.customGroups[0]?.id ?? "";
    });
  }, [communicationState.customGroups]);

  const selectedPerson = useMemo(
    () =>
      messageSelectablePeople.find((person) => person.id === selectedPersonId) ??
      null,
    [messageSelectablePeople, selectedPersonId],
  );
  const selectedGroup = useMemo(
    () =>
      communicationState.customGroups.find((group) => group.id === selectedGroupId) ??
      null,
    [communicationState.customGroups, selectedGroupId],
  );
  const customGroupOptions = useMemo(
    () =>
      communicationState.customGroups.map((group) => {
        const recipients = resolveMessageRecipientsFromIds(
          group.memberIds,
          messageRecipientsById,
          staffById,
        );
        const sections = buildMessageRecipientSections(recipients);

        return {
          ...group,
          recipientSummary: formatMessageRecipientSummary(sections),
        };
      }),
    [communicationState.customGroups, messageRecipientsById, staffById],
  );
  const messageConversationThreads = useMemo<MessageConversationThread[]>(
    () =>
      buildShiftCommunicationThreadSummaries(communicationState.messages).map((thread) => {
        const recipients = resolveMessageRecipientsFromIds(
          thread.recipientIds,
          messageRecipientsById,
          staffById,
        );
        const recipientSections = buildMessageRecipientSections(recipients);
        const directRecipient =
          thread.audience === "individualPeople" && thread.recipientIds.length === 1
            ? staffById.get(thread.recipientIds[0] ?? "")
            : null;
        const linkedShift = thread.shiftId
          ? shiftItems.find((shift) => shift.id === thread.shiftId) ?? null
          : null;
        const linkedGroup = thread.groupId
          ? communicationState.customGroups.find((group) => group.id === thread.groupId) ??
            null
          : null;
        const title =
          thread.audience === "bookedOnShift"
            ? linkedShift
              ? `${linkedShift.role} shift`
              : "All booked staff"
            : thread.audience === "standLeaders"
              ? "Stand leaders"
              : thread.audience === "customGroup"
                ? linkedGroup?.name ?? thread.audienceLabel
                : directRecipient ? `${directRecipient.firstName} ${directRecipient.lastName}` : thread.audienceLabel;

        return {
          ...thread,
          title,
          preview: buildShiftCommunicationMessagePreview(thread.latestMessage),
          recipients,
          recipientSections,
        };
      }),
    [
      communicationState.customGroups,
      communicationState.messages,
      messageRecipientsById,
      shiftItems,
      staffById,
    ],
  );

  useEffect(() => {
    setActiveMessageThreadId((current) =>
      current && messageConversationThreads.some((thread) => thread.id === current)
        ? current
        : null,
    );
  }, [messageConversationThreads]);

  const resolvedMessageTarget = useMemo(() => {
    if (messageAudience === "bookedOnShift") {
      return {
        audience: "bookedOnShift" as const,
        label: "To ALL BOOKED staff",
        recipientIds: allBookedMessageRecipients.map((person) => person.id),
        recipients: allBookedMessageRecipients,
        shiftId: undefined,
        groupId: undefined,
      };
    }

    if (messageAudience === "standLeaders") {
      const recipients = sortPeopleByName(
        standLeaderRecipients.map((person) =>
          buildMessageRecipient(person, "Confirmed"),
        ),
      );

      return {
        audience: "standLeaders" as const,
        label: "All stand leaders",
        recipientIds: recipients.map((person) => person.id),
        recipients,
        shiftId: undefined,
        groupId: undefined,
      };
    }

    if (messageAudience === "individualPeople") {
      return {
        audience: "individualPeople" as const,
        label: selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : "Individual person",
        recipientIds: selectedPerson ? [selectedPerson.id] : [],
        recipients: selectedPerson ? [selectedPerson] : [],
        shiftId: undefined,
        groupId: undefined,
      };
    }

    const recipients = resolveMessageRecipientsFromIds(
      selectedGroup?.memberIds ?? [],
      messageRecipientsById,
      staffById,
    );

    return {
      audience: "customGroup" as const,
      label: selectedGroup?.name ?? "Custom group",
      recipientIds: recipients.map((person) => person.id),
      recipients,
      shiftId: undefined,
      groupId: selectedGroup?.id,
    };
  }, [
    messageAudience,
    allBookedMessageRecipients,
    standLeaderRecipients,
    selectedPerson,
    selectedGroup,
    messageRecipientsById,
    staffById,
  ]);
  const resolvedMessageRecipientSections = useMemo(
    () => buildMessageRecipientSections(resolvedMessageTarget.recipients),
    [resolvedMessageTarget.recipients],
  );
  const hasNonBookedMessageRecipients = resolvedMessageTarget.recipients.some(
    (person) => person.messageStatus !== "Confirmed",
  );
  const activeMessageThread = useMemo(
    () =>
      activeMessageThreadId
        ? messageConversationThreads.find((thread) => thread.id === activeMessageThreadId) ??
          null
        : null,
    [activeMessageThreadId, messageConversationThreads],
  );
  const preferredAudienceMessageThread = useMemo(() => {
    if (messageAudience === "bookedOnShift") {
      return (
        messageConversationThreads.find(
          (thread) => thread.audience === "bookedOnShift" && !thread.shiftId,
        ) ?? null
      );
    }

    if (messageAudience === "standLeaders") {
      return (
        messageConversationThreads.find(
          (thread) => thread.audience === "standLeaders",
        ) ?? null
      );
    }

    if (messageAudience === "customGroup" && selectedGroupId) {
      return (
        messageConversationThreads.find(
          (thread) =>
            thread.audience === "customGroup" &&
            thread.groupId === selectedGroupId,
        ) ?? null
      );
    }

    return null;
  }, [messageAudience, messageConversationThreads, selectedGroupId]);
  const messageDraftTarget = activeMessageThread
    ? {
        audience: activeMessageThread.audience,
        label: activeMessageThread.title,
        audienceLabel: activeMessageThread.audienceLabel,
        recipientIds: activeMessageThread.recipientIds,
        recipients: activeMessageThread.recipients,
        shiftId: activeMessageThread.shiftId,
        groupId: activeMessageThread.groupId,
        threadId: activeMessageThread.id,
        allowReplies: activeMessageThread.allowReplies,
      }
    : {
        ...resolvedMessageTarget,
        audienceLabel: resolvedMessageTarget.label,
        threadId: undefined,
        allowReplies: messageAudience !== "bookedOnShift",
      };
  const messageDraftRecipientSections = activeMessageThread
    ? activeMessageThread.recipientSections
    : resolvedMessageRecipientSections;
  const hasNonBookedDraftRecipients = activeMessageThread
    ? activeMessageThread.recipients.some(
        (person) => person.messageStatus !== "Confirmed",
      )
    : hasNonBookedMessageRecipients;

  useEffect(() => {
    if (activeMessageThreadId || !preferredAudienceMessageThread) {
      return;
    }

    setActiveMessageThreadId(preferredAudienceMessageThread.id);
    setMessageError(null);
  }, [
    activeMessageThreadId,
    preferredAudienceMessageThread,
  ]);

  function replaceShift(updatedShift: Shift) {
    setShiftItems((current) =>
      current.map((shift) =>
        shift.id === updatedShift.id ? updatedShift : shift,
      ),
    );
  }

  function findOtherAssignment(
    shiftId: string,
    staffId: string,
  ): ShiftAssignmentLocation | null {
    for (const shift of shiftItems) {
      if (shift.id === shiftId) {
        continue;
      }

      const assignment = shift.assignments.find(
        (item) => item.staffId === staffId,
      );

      if (assignment) {
        return {
          shift,
          bookingStatus: assignment.bookingStatus,
        };
      }
    }

    return null;
  }

  function toggleBookingShift(shiftId: string, defaultExpanded: boolean) {
    setBookingShiftExpansion((current) => ({
      ...current,
      [shiftId]: !(current[shiftId] ?? defaultExpanded),
    }));
  }

  function toggleWaitlistShift(shiftId: string) {
    setWaitlistShiftExpansion((current) => ({
      ...current,
      [shiftId]: !(current[shiftId] ?? false),
    }));
  }

  async function patchAssignment(
    shiftId: string,
    staffId: string,
    bookingStatus: BookingStatus | null,
  ) {
    const response = await fetch(`/api/gigs/${gigId}/shifts/${shiftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffId, bookingStatus }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; shift?: Shift }
      | null;

    if (!response.ok || !payload?.shift) {
      throw new Error(payload?.error ?? "Could not update shift booking.");
    }

    replaceShift(payload.shift);
    return payload.shift;
  }

  async function handleAssignmentUpdate(
    shiftId: string,
    staffId: string,
    bookingStatus: BookingStatus,
  ) {
    const actionKey = `${shiftId}:${staffId}:${bookingStatus}`;
    setPendingBookingKey(actionKey);
    setBookingError(null);

    try {
      await patchAssignment(shiftId, staffId, bookingStatus);
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : "Could not update the booking.",
      );
    } finally {
      setPendingBookingKey(null);
    }
  }

  async function handleRemoveAssignment(
    shiftId: string,
    staffId: string,
    errorMessage: string,
  ) {
    const actionKey = `${shiftId}:${staffId}:remove`;
    setPendingBookingKey(actionKey);
    setBookingError(null);

    try {
      await patchAssignment(shiftId, staffId, null);
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : errorMessage,
      );
    } finally {
      setPendingBookingKey(null);
    }
  }

  function handleOpenNewShift() {
    if (!canCreateShifts) {
      setFormError(
        shiftCreationMessage ?? "This gig must be In Progress or Confirmed before shifts can be created.",
      );
      return;
    }

    setIsCreatingShift(true);
    setFormError(null);
    setNewShiftForm(buildInitialShiftForm(shiftItems[0]));
  }

  function handleCancelNewShift() {
    setIsCreatingShift(false);
    setFormError(null);
    setNewShiftForm(buildInitialShiftForm(shiftItems[0]));
  }

  useEffect(() => {
    if (canCreateShifts) {
      return;
    }

    setIsCreatingShift(false);
  }, [canCreateShifts]);

  async function handleCreateShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const customRole = newShiftForm.customRole.trim();

    if (newShiftForm.role === "Other" && !customRole) {
      setFormError("Add a name for the custom shift.");
      return;
    }

    const requiredStaff = Number(newShiftForm.requiredStaff);
    const priorityLevel = Number(newShiftForm.priorityLevel);

    if (!Number.isFinite(requiredStaff) || requiredStaff < 1) {
      setFormError("Number of passes must be at least 1.");
      return;
    }

    if (!Number.isFinite(priorityLevel) || priorityLevel < 1 || priorityLevel > 5) {
      setFormError("Priority level must be between 1 and 5.");
      return;
    }

    setIsSavingShift(true);

    try {
      const response = await fetch(`/api/gigs/${gigId}/shifts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: newShiftForm.role,
          customRole,
          priorityLevel,
          requiredStaff,
          startTime: newShiftForm.startTime,
          endTime: newShiftForm.endTime,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; shifts?: Shift[] }
        | null;

      if (!response.ok || !result?.shifts) {
        setFormError(result?.error ?? "Could not create the shift.");
        return;
      }

      setShiftItems(result.shifts);
      setIsCreatingShift(false);
      setNewShiftForm(buildInitialShiftForm(result.shifts[0]));
      startTransition(() => router.refresh());
    } catch {
      setFormError("Could not create the shift.");
    } finally {
      setIsSavingShift(false);
    }
  }

  function handleRequestDeleteShift(shiftToDelete: Shift) {
    setDeleteShiftError(null);
    setShiftPendingDelete(shiftToDelete);
  }

  function handleCancelDeleteShift() {
    if (isDeletingShift) {
      return;
    }

    setDeleteShiftError(null);
    setShiftPendingDelete(null);
  }

  async function handleConfirmDeleteShift() {
    if (!shiftPendingDelete) {
      return;
    }

    setFormError(null);
    setDeleteShiftError(null);
    setIsDeletingShift(true);

    try {
      const response = await fetch(
        `/api/gigs/${gigId}/shifts/${shiftPendingDelete.id}`,
        {
          method: "DELETE",
        },
      );

      const result = (await response.json().catch(() => null)) as
        | { error?: string; shifts?: Shift[] }
        | null;

      if (!response.ok || !result?.shifts) {
        setDeleteShiftError(result?.error ?? "Could not delete the shift.");
        return;
      }

      setShiftItems(result.shifts);
      setShiftPendingDelete(null);
      startTransition(() => router.refresh());
    } catch {
      setDeleteShiftError("Could not delete the shift.");
    } finally {
      setIsDeletingShift(false);
    }
  }

  function toggleGroupMember(staffId: string) {
    setGroupMemberIds((current) =>
      current.includes(staffId)
        ? current.filter((memberId) => memberId !== staffId)
        : [...current, staffId],
    );
  }

  function handleOpenMessageThread(threadId: string) {
    const thread = messageConversationThreads.find((entry) => entry.id === threadId);

    if (!thread) {
      return;
    }

    setActiveMessageThreadId(threadId);
    setMessageAudience(thread.audience);
    setMessageError(null);

    if (thread.audience === "individualPeople" && thread.recipientIds.length === 1) {
      setSelectedPersonId(thread.recipientIds[0] ?? "");
      return;
    }

    if (thread.audience === "customGroup" && thread.groupId) {
      setSelectedGroupId(thread.groupId);
    }
  }

  function handleMessageAttachmentSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const nextFiles = Array.from(event.target.files ?? []);

    if (nextFiles.length === 0) {
      return;
    }

    setMessageAttachments((current) =>
      mergeSelectedMessageAttachments(current, nextFiles),
    );
    setMessageError(null);
    event.target.value = "";
  }

  function handleRemoveMessageAttachment(fileToRemove: File) {
    const signatureToRemove = buildMessageAttachmentSignature(fileToRemove);

    setMessageAttachments((current) =>
      current.filter(
        (file) => buildMessageAttachmentSignature(file) !== signatureToRemove,
      ),
    );
  }

  async function handleCreateMessageGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupError(null);

    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setGroupError("Add a name for the group.");
      return;
    }

    if (groupMemberIds.length === 0) {
      setGroupError("Choose at least one staff member.");
      return;
    }

    setIsSavingGroup(true);

    try {
      const response = await fetch(`/api/gigs/${gigId}/shift-communications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "group",
          name: trimmedName,
          memberIds: groupMemberIds,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; state?: ShiftCommunicationState }
        | null;

      if (!response.ok || !result?.state) {
        setGroupError(result?.error ?? "Could not create the group.");
        return;
      }

      setCommunicationState(result.state);
      setSelectedGroupId(result.state.customGroups[0]?.id ?? "");
      setGroupName("");
      setGroupMemberIds([]);
    } catch {
      setGroupError("Could not create the group.");
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageError(null);

    const trimmedBody = messageBody.trim();

    if (!trimmedBody && messageAttachments.length === 0) {
      setMessageError("Write a message or add at least one attachment first.");
      return;
    }

    if (messageDraftTarget.recipientIds.length === 0) {
      setMessageError("Choose at least one recipient.");
      return;
    }

    setIsSendingMessage(true);

    try {
      const formData = new FormData();
      formData.append("body", trimmedBody);
      messageAttachments.forEach((file) => formData.append("attachment", file));

      const response = activeMessageThread
        ? await fetch(
            `/api/gigs/${gigId}/shift-communications/threads/${activeMessageThread.id}/messages`,
            {
              method: "POST",
              body: formData,
            },
          )
        : await (async () => {
            formData.append("type", "message");
            formData.append("audience", messageDraftTarget.audience);
            formData.append("audienceLabel", messageDraftTarget.audienceLabel);
            formData.append(
              "allowReplies",
              messageDraftTarget.allowReplies ? "true" : "false",
            );
            messageDraftTarget.recipientIds.forEach((recipientId) =>
              formData.append("recipientIds", recipientId),
            );

            if (messageDraftTarget.shiftId) {
              formData.append("shiftId", messageDraftTarget.shiftId);
            }

            if (messageDraftTarget.groupId) {
              formData.append("groupId", messageDraftTarget.groupId);
            }

            return fetch(`/api/gigs/${gigId}/shift-communications`, {
              method: "POST",
              body: formData,
            });
          })();

      const result = (await response.json().catch(() => null)) as
        | { error?: string; state?: ShiftCommunicationState }
        | null;

      if (!response.ok || !result?.state) {
        setMessageError(result?.error ?? "Could not save the message.");
        return;
      }

      setCommunicationState(result.state);
      setMessageBody("");
      setMessageAttachments([]);
      setMessageAttachmentInputKey((current) => current + 1);
    } catch {
      setMessageError("Could not save the message.");
    } finally {
      setIsSendingMessage(false);
    }
  }

  return (
    <section className="stack-column">
      {firstShift ? (
        <DetailTabs
          tabs={shiftTabs}
          current={activeTab}
          basePath={`/gigs/${gigId}?tab=shifts`}
          getHref={(tab) => {
            if (tab.slug === "overview") {
              return `/gigs/${gigId}?tab=shifts`;
            }

            if (tab.slug === "booking") {
              return `/gigs/${gigId}?tab=shifts&shiftTab=booking`;
            }

            if (tab.slug === "waitlist") {
              return `/gigs/${gigId}?tab=shifts&shiftTab=waitlist`;
            }

            if (tab.slug === "messages") {
              return `/gigs/${gigId}?tab=shifts&shiftTab=messages`;
            }

            return `/gigs/${gigId}?tab=shifts`;
          }}
        />
      ) : (
        <div className="route-tabs shift-hub-tabs">
          {shiftTabs.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              className={`route-tab ${
                tab.slug === "overview" ? "active" : "disabled"
              }`}
              disabled={tab.slug !== "overview"}
              aria-disabled={tab.slug !== "overview"}
              title={
                tab.slug !== "overview"
                  ? canCreateShifts
                    ? "Create a shift first."
                    : shiftCreationMessage ?? "Create a shift first."
                  : undefined
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "overview" ? (
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Shifts</p>
              <h2>Open shifts</h2>
            </div>
            <div className="section-actions">
              <button
                type="button"
                className="button ghost"
                onClick={handleOpenNewShift}
                disabled={!canCreateShifts}
                title={
                  !canCreateShifts
                    ? shiftCreationMessage ?? "This gig must be In Progress or Confirmed before shifts can be created."
                    : undefined
                }
              >
                New shifts
              </button>
            </div>
          </div>

          {!canCreateShifts && shiftCreationMessage && shiftItems.length > 0 ? (
            <div className="empty-panel">{shiftCreationMessage}</div>
          ) : null}

          {isCreatingShift ? (
            <form className="new-shift-panel" onSubmit={handleCreateShift}>
              <div className="new-shift-panel-header">
                <div>
                  <strong>New operational unit</strong>
                  <p className="muted">
                    Choose role, priority threshold, number of passes, and shift times.
                  </p>
                </div>
              </div>

              <div className="new-shift-grid">
                <label className="field">
                  <span>Shift type</span>
                  <select
                    value={newShiftForm.role}
                    onChange={(event) =>
                      setNewShiftForm((current) => ({
                        ...current,
                        role: event.target.value as ShiftRoleOption,
                      }))
                    }
                  >
                    <option value="Stand Leader">Stand Leader</option>
                    <option value="Seller">Seller</option>
                    <option value="Runner">Runner</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="field">
                  <span>Priority level</span>
                  <select
                    value={newShiftForm.priorityLevel}
                    onChange={(event) =>
                      setNewShiftForm((current) => ({
                        ...current,
                        priorityLevel: event.target.value,
                      }))
                    }
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </label>

                {newShiftForm.role === "Other" ? (
                  <label className="field">
                    <span>Custom shift name</span>
                    <input
                      value={newShiftForm.customRole}
                      onChange={(event) =>
                        setNewShiftForm((current) => ({
                          ...current,
                          customRole: event.target.value,
                        }))
                      }
                      placeholder="Example: Stock Lead"
                    />
                  </label>
                ) : null}

                <label className="field">
                  <span>Number of passes</span>
                  <input
                    type="number"
                    min={1}
                    value={newShiftForm.requiredStaff}
                    onChange={(event) =>
                      setNewShiftForm((current) => ({
                        ...current,
                        requiredStaff: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Start time</span>
                  <input
                    type="time"
                    value={newShiftForm.startTime}
                    onChange={(event) =>
                      setNewShiftForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>End time</span>
                  <input
                    type="time"
                    value={newShiftForm.endTime}
                    onChange={(event) =>
                      setNewShiftForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              {formError ? <p className="form-error">{formError}</p> : null}

              <div className="new-shift-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={handleCancelNewShift}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={isSavingShift}
                >
                  {isSavingShift ? "Creating..." : "Create shift"}
                </button>
              </div>
            </form>
          ) : formError ? (
            <p className="form-error">{formError}</p>
          ) : null}

          {shiftItems.length === 0 ? (
            <div className="empty-panel">
              {canCreateShifts
                ? "No open shifts have been created for this gig yet."
                : shiftCreationMessage ?? "No shifts can be created for this gig yet."}
            </div>
          ) : (
            <div className="gig-grid">
              {shiftItems.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  href={`/gigs/${gigId}/shifts/${shift.id}`}
                  onDelete={() => handleRequestDeleteShift(shift)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "booking" ? (
        <section className="card">
          <div className="booking-layout">
            <div className="booking-main">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Staff booking</p>
                  <h2>Shift booking requests</h2>
                </div>
              </div>

              {bookingError ? <p className="form-error">{bookingError}</p> : null}

              {bookingShiftItems.length === 0 ? (
                <div className="empty-panel">
                  No shifts have been created for this gig yet.
                </div>
              ) : (
                <div className="shift-booking-board">
                  {bookingShiftItems.map((shift) => {
                    const unsortedCandidates =
                      candidatePoolByShift.get(shift.id) ?? [];
                    const openSlots = getOpenSlotsForShift(shift);
                    const bookedCount = getConfirmedCountForShift(shift);
                    const waitlistCount = getWaitlistCountForShift(shift);
                    const shiftExpanded =
                      bookingShiftExpansion[shift.id] ?? (openSlots > 0);
                    const confirmedNames = sortPeopleByName(
                      shift.assignments
                        .filter(
                          (assignment) => assignment.bookingStatus === "Confirmed",
                        )
                        .map((assignment) => staffById.get(assignment.staffId))
                        .filter(
                          (person): person is BookingCandidate => Boolean(person),
                        ),
                    ).map((person) => `${person.firstName} ${person.lastName}`);
                    const collapsedBookingSummary =
                      confirmedNames.length === 0
                        ? `No confirmed staff booked yet. ${
                            openSlots === 0
                              ? "Shift is fully booked."
                              : `${openSlots} open slot${
                                  openSlots === 1 ? "" : "s"
                                } remaining.`
                          }`
                        : `${confirmedNames.slice(0, 2).join(", ")}${
                            confirmedNames.length > 2
                              ? ` + ${confirmedNames.length - 2} more`
                              : ""
                          } booked on this shift. ${
                            openSlots === 0
                              ? "Shift is fully booked."
                              : `${openSlots} open slot${
                                  openSlots === 1 ? "" : "s"
                                } remaining.`
                          }`;
                    const candidates = [...unsortedCandidates]
                      .sort((left, right) => {
                        const leftCurrent = shift.assignments.find(
                          (assignment) => assignment.staffId === left.id,
                        );
                        const rightCurrent = shift.assignments.find(
                          (assignment) => assignment.staffId === right.id,
                        );

                        if (leftCurrent && !rightCurrent) {
                          return -1;
                        }

                        if (!leftCurrent && rightCurrent) {
                          return 1;
                        }

                        return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`);
                      })
                      .filter((person) => {
                        const currentStatus = shift.assignments.find(
                          (assignment) => assignment.staffId === person.id,
                        )?.bookingStatus;

                        return currentStatus !== "Waitlisted";
                      });

                    return (
                      <section key={shift.id} className="booking-board-group">
                        <div className="booking-board-head">
                          <div className="booking-board-head-main">
                            <button
                              type="button"
                              className={`booking-board-toggle ${
                                shiftExpanded ? "expanded" : "collapsed"
                              }`}
                              onClick={() =>
                                toggleBookingShift(shift.id, openSlots > 0)
                              }
                              aria-expanded={shiftExpanded}
                            >
                              <span
                                className="booking-board-toggle-icon"
                                aria-hidden="true"
                              >
                                {shiftExpanded ? "v" : ">"}
                              </span>
                              <span className="booking-board-toggle-copy">
                                <span className="booking-board-toggle-topline">
                                  <span className="eyebrow">{shift.role}</span>
                                  <span className="chip booking-board-priority-chip">
                                    Priority {shift.priorityLevel}
                                  </span>
                                </span>
                                <span className="booking-board-toggle-title">
                                  {shift.startTime} to {shift.endTime}
                                </span>
                              </span>
                            </button>

                            {shiftExpanded ? (
                              <p className="muted">
                                {shift.notes || collapsedBookingSummary}
                              </p>
                            ) : (
                              <p className="muted booking-board-collapsed-note">
                                {collapsedBookingSummary}
                              </p>
                            )}
                          </div>

                          <div className="booking-board-meta">
                            <span className="chip">Booked {bookedCount}</span>
                            <span className="chip">Open {shift.requiredStaff}</span>
                            <span className="chip">Waitlist {waitlistCount}</span>
                          </div>
                        </div>

                        {!shiftExpanded ? null : candidates.length === 0 ? (
                          <div className="empty-panel">
                            No staff match this role, country, region, and priority level yet.
                          </div>
                        ) : (
                          <div className="booking-board-table">
                            <div className="booking-board-row booking-board-row-header">
                              <span>Staff</span>
                              <span>Location</span>
                              <span>Status</span>
                              <span>Actions</span>
                            </div>

                            {candidates.map((person) => {
                              const currentStatus = shift.assignments.find(
                                (assignment) => assignment.staffId === person.id,
                              )?.bookingStatus;
                              const otherAssignment = currentStatus
                                ? null
                                : findOtherAssignment(shift.id, person.id);
                              const rowKey = `${shift.id}:${person.id}`;
                              const isPending =
                                pendingBookingKey === `${rowKey}:Confirmed` ||
                                pendingBookingKey === `${rowKey}:Waitlisted` ||
                                pendingBookingKey === `${rowKey}:remove`;

                              return (
                                <div key={person.id} className="booking-board-row">
                                  <div className="booking-board-primary">
                                    <strong>{person.firstName} {person.lastName}</strong>
                                    <p className="small-text">
                                      {person.roles.join(", ")}
                                    </p>
                                  </div>

                                  <div className="booking-board-secondary">
                                    {person.region}, {person.country}
                                  </div>

                                  <div className="booking-board-status">
                                    {currentStatus ? (
                                      <StatusBadge label={currentStatus} />
                                    ) : otherAssignment ? (
                                      <span className="small-text">
                                        On {otherAssignment.shift.role} (
                                        {otherAssignment.bookingStatus})
                                      </span>
                                    ) : (
                                      null
                                    )}
                                  </div>

                                  <div className="booking-board-actions">
                                    {currentStatus !== "Confirmed" &&
                                    openSlots > 0 ? (
                                      <button
                                        type="button"
                                        className="button ghost"
                                        disabled={isPending}
                                        onClick={() =>
                                          handleAssignmentUpdate(
                                            shift.id,
                                            person.id,
                                            "Confirmed",
                                          )
                                        }
                                      >
                                        Book
                                      </button>
                                    ) : null}

                                    {currentStatus !== "Confirmed" &&
                                    currentStatus !== "Waitlisted" ? (
                                      <button
                                        type="button"
                                        className="button ghost"
                                        disabled={isPending}
                                        onClick={() =>
                                          handleAssignmentUpdate(
                                            shift.id,
                                            person.id,
                                            "Waitlisted",
                                          )
                                        }
                                      >
                                        Waitlist
                                      </button>
                                    ) : null}

                                    {currentStatus === "Confirmed" ? (
                                      <button
                                        type="button"
                                        className="button ghost"
                                        disabled={isPending}
                                        onClick={() =>
                                          handleRemoveAssignment(
                                            shift.id,
                                            person.id,
                                            "Could not cancel the booking.",
                                          )
                                        }
                                      >
                                        Cancel booking
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="booking-summary-card" aria-label="Booking coverage">
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">Info</p>
                  <h3>Booked coverage</h3>
                </div>
              </div>

              <div className="booking-summary-percent">
                <strong>{bookingCoverage.percentBooked}%</strong>
                <p>
                  {bookingCoverage.totalBookedSlots} of{" "}
                  {bookingCoverage.totalRequiredSlots} required shift slots are
                  confirmed.
                </p>
              </div>

              <div
                className="booking-summary-progress"
                role="progressbar"
                aria-label="Booked shift coverage"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={bookingCoverage.percentBooked}
              >
                <span
                  style={{ width: `${bookingCoverage.percentBooked}%` }}
                />
              </div>

              <p className="helper-caption">
                {bookingCoverage.totalRequiredSlots === 0
                  ? "Add staffing requirements to track booking coverage here."
                  : `${bookingCoverage.totalOpenSlots} open slots remain across ${shiftItems.length} shifts.`}
              </p>

              <div className="booking-summary-stats">
                <div className="booking-summary-stat">
                  <span>Booked slots</span>
                  <strong>{bookingCoverage.totalBookedSlots}</strong>
                </div>
                <div className="booking-summary-stat">
                  <span>Open slots</span>
                  <strong>{bookingCoverage.totalOpenSlots}</strong>
                </div>
                <div className="booking-summary-stat">
                  <span>Fully booked shifts</span>
                  <strong>{bookingCoverage.fullyBookedShiftCount}</strong>
                </div>
                <div className="booking-summary-stat">
                  <span>Waitlist</span>
                  <strong>{bookingCoverage.totalWaitlistCount}</strong>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {activeTab === "booking" || activeTab === "waitlist" ? (
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Waitlist</p>
              <h2>Waitlisted staff</h2>
            </div>
          </div>

          {bookingError ? <p className="form-error">{bookingError}</p> : null}

          {waitlistedShiftItems.length === 0 ? (
            <div className="empty-panel">
              No staff are currently waitlisted on this gig.
            </div>
          ) : (
            <div className="shift-booking-board">
              {waitlistedShiftItems.map((shift) => {
                const openSlots = getOpenSlotsForShift(shift);
                const candidateLookup = new Map(
                  (candidatePoolByShift.get(shift.id) ?? []).map((person) => [
                    person.id,
                    person,
                  ]),
                );
                const waitlistedPeople = shift.assignments
                  .filter(
                    (assignment) => assignment.bookingStatus === "Waitlisted",
                  )
                  .map((assignment) => ({
                    assignment,
                    person: candidateLookup.get(assignment.staffId),
                  }));
                const waitlistNames = waitlistedPeople.map(
                  ({ assignment, person }) =>
                    person ? `${person.firstName} ${person.lastName}` : assignment.staffId,
                );
                const waitlistExpanded =
                  waitlistShiftExpansion[shift.id] ?? false;
                const collapsedWaitlistSummary = `${waitlistNames
                  .slice(0, 2)
                  .join(", ")}${
                  waitlistNames.length > 2
                    ? ` + ${waitlistNames.length - 2} more`
                    : ""
                } currently on the waitlist. ${
                  openSlots === 0
                    ? "No open slots right now."
                    : `${openSlots} open slot${
                        openSlots === 1 ? "" : "s"
                      } available.`
                }`;

                return (
                  <section key={shift.id} className="booking-board-group">
                    <div className="booking-board-head">
                      <div className="booking-board-head-main">
                        <button
                          type="button"
                          className={`booking-board-toggle ${
                            waitlistExpanded ? "expanded" : "collapsed"
                          }`}
                          onClick={() => toggleWaitlistShift(shift.id)}
                          aria-expanded={waitlistExpanded}
                        >
                          <span
                            className="booking-board-toggle-icon"
                            aria-hidden="true"
                          >
                            {waitlistExpanded ? "v" : ">"}
                          </span>
                          <span className="booking-board-toggle-copy">
                            <span className="eyebrow">{shift.role}</span>
                            <span className="booking-board-toggle-title">
                              {shift.startTime} to {shift.endTime}
                            </span>
                          </span>
                        </button>

                        {waitlistExpanded ? (
                          <p className="muted">
                            {shift.notes || collapsedWaitlistSummary}
                          </p>
                        ) : (
                          <p className="muted booking-board-collapsed-note">
                            {collapsedWaitlistSummary}
                          </p>
                        )}
                      </div>

                      <div className="booking-board-meta">
                        <span className="chip">
                          Priority {shift.priorityLevel}
                        </span>
                        <span className="chip">Required {shift.requiredStaff}</span>
                        <span className="chip">
                          Open {openSlots}
                        </span>
                        <span className="chip">
                          Waitlist {getWaitlistCountForShift(shift)}
                        </span>
                      </div>
                    </div>

                    {!waitlistExpanded ? null : (
                      <div className="booking-board-table">
                        <div className="booking-board-row booking-board-row-header">
                          <span>Staff</span>
                          <span>Location</span>
                          <span>Status</span>
                          <span>Actions</span>
                        </div>

                        {waitlistedPeople.map(({ assignment, person }) => {
                          const rowKey = `${shift.id}:${assignment.staffId}`;
                          const isPending =
                            pendingBookingKey === `${rowKey}:Confirmed` ||
                            pendingBookingKey === `${rowKey}:Waitlisted` ||
                            pendingBookingKey === `${rowKey}:remove`;

                          return (
                            <div key={assignment.staffId} className="booking-board-row">
                              <div className="booking-board-primary">
                                <strong>{person ? `${person.firstName} ${person.lastName}` : assignment.staffId}</strong>
                                <p className="small-text">
                                  {person?.roles.join(", ") ?? "Staff member"}
                                </p>
                              </div>

                              <div className="booking-board-secondary">
                                {person
                                  ? `${person.region}, ${person.country}`
                                  : "Profile not found"}
                              </div>

                              <div className="booking-board-status">
                                <StatusBadge label="Waitlisted" />
                              </div>

                              <div className="booking-board-actions">
                                {openSlots > 0 ? (
                                  <button
                                    type="button"
                                    className="button ghost"
                                    disabled={isPending}
                                    onClick={() =>
                                      handleAssignmentUpdate(
                                        shift.id,
                                        assignment.staffId,
                                        "Confirmed",
                                      )
                                    }
                                  >
                                    Book
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="button ghost"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleRemoveAssignment(
                                      shift.id,
                                      assignment.staffId,
                                      "Could not remove the waitlist entry.",
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "messages" ? (
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Messages</p>
              <h2>Shift communication</h2>
            </div>
          </div>

          <div className="message-audience-row">
            {[
              { key: "bookedOnShift", label: "Booked on shift" },
              { key: "standLeaders", label: "Stand leaders" },
              { key: "individualPeople", label: "Individual people" },
              { key: "customGroup", label: "Custom groups" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={`chip chip-soft ${
                  messageAudience === option.key ? "active" : ""
                }`}
                onClick={() => {
                  setActiveMessageThreadId(null);
                  setMessageAudience(option.key as ShiftMessageAudience);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="message-workspace">
            <section className="message-column message-column-primary">
              {messageAudience === "individualPeople" ? (
                <label className="field">
                  <span>Choose staff member</span>
                  <select
                    value={selectedPerson?.id ?? ""}
                    onChange={(event) => {
                      setActiveMessageThreadId(null);
                      setSelectedPersonId(event.target.value);
                    }}
                  >
                    {messageSelectablePeople.length === 0 ? (
                      <option value="">No assigned staff yet</option>
                    ) : null}
                    {messageSelectableSections.map((section) => (
                      <optgroup
                        key={section.key}
                        label={`${section.label} (${section.people.length})`}
                      >
                        {section.people.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.firstName} {person.lastName}
                            {section.key === "Confirmed"
                              ? ""
                              : ` (${section.optionLabel})`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="helper-caption">
                    Booked staff are listed first. Waitlist and pending staff stay
                    in separate sections so you do not message the wrong people.
                  </p>
                </label>
              ) : null}

              {messageAudience === "customGroup" ? (
                <div className="message-groups-layout">
                  <div className="message-group-selector">
                    <label className="field">
                      <span>Saved groups</span>
                      <select
                        value={selectedGroup?.id ?? ""}
                        onChange={(event) => {
                          setActiveMessageThreadId(null);
                          setSelectedGroupId(event.target.value);
                        }}
                      >
                        {communicationState.customGroups.length === 0 ? (
                          <option value="">No custom groups yet</option>
                        ) : null}
                        {customGroupOptions.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                            {group.recipientSummary
                              ? ` (${group.recipientSummary})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <p className="helper-caption">
                        Saved groups show how many booked, waitlist, pending, or
                        not booked members they contain.
                      </p>
                    </label>
                  </div>

                  <form className="message-group-builder" onSubmit={handleCreateMessageGroup}>
                    <div className="message-group-builder-head">
                      <div>
                        <strong>Build custom group</strong>
                        <p className="muted">
                          Pick staff members and save the group for reuse.
                        </p>
                      </div>
                    </div>

                    <label className="field">
                      <span>Group name</span>
                      <input
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value)}
                        placeholder="Example: Main sellers"
                      />
                    </label>

                    <div className="message-member-sections">
                      {messageSelectablePeople.length === 0 ? (
                        <div className="empty-panel">
                          No assigned staff are available to group yet.
                        </div>
                      ) : (
                        messageSelectableSections.map((section) => (
                          <section key={section.key} className="message-member-section">
                            <div className="message-member-section-head">
                              <div>
                                <strong>{section.label}</strong>
                                <p>{section.helperText}</p>
                              </div>
                              <span className="chip">{section.people.length}</span>
                            </div>

                            <div className="message-member-grid">
                              {section.people.map((person) => {
                                const selected = groupMemberIds.includes(person.id);
                                return (
                                  <button
                                    key={person.id}
                                    type="button"
                                    className={`message-member-pill ${
                                      selected ? "active" : ""
                                    }`}
                                    onClick={() => toggleGroupMember(person.id)}
                                  >
                                    <div className="message-member-pill-head">
                                      <strong>{person.firstName} {person.lastName}</strong>
                                      <StatusBadge
                                        label={section.badgeLabel}
                                        tone={section.badgeTone}
                                      />
                                    </div>
                                    <span>
                                      {person.region}, {person.country}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))
                      )}
                    </div>

                    {groupError ? <p className="form-error">{groupError}</p> : null}

                    <div className="message-group-actions">
                      <button
                        type="submit"
                        className="button ghost"
                        disabled={isSavingGroup}
                      >
                        {isSavingGroup ? "Saving..." : "Save group"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              <section className="message-target-panel">
                <div className="section-head compact">
                  <div>
                    <p className="eyebrow">
                      {activeMessageThread ? "Open conversation" : "Audience"}
                    </p>
                    <h3>{messageDraftTarget.label}</h3>
                  </div>
                  <span className="chip">
                    Recipients {messageDraftTarget.recipientIds.length}
                  </span>
                </div>

                {activeMessageThread ? (
                  <div className="message-active-thread-summary">
                    <div>
                      <strong>Resume conversation</strong>
                      <p>
                        Continue the same thread here and from the SCM STAFF mobile
                        view. Fixed audience threads reopen automatically from their
                        menu so `Booked on shift` and `Stand leaders` always stay in
                        the same chat.
                      </p>
                    </div>
                  </div>
                ) : null}

                {messageDraftTarget.audience === "bookedOnShift" ? null : messageDraftTarget.recipients.length ===
                  0 ? (
                  <div className="empty-panel">
                    No recipients match this audience yet.
                  </div>
                ) : (
                  <div className="message-recipient-sections">
                    {hasNonBookedDraftRecipients ? (
                      <div className="message-recipient-warning">
                        This audience includes people who are not currently booked.
                        Review the status sections below before saving the message.
                      </div>
                    ) : null}

                    {messageDraftRecipientSections.map((section) => (
                      <section key={section.key} className="message-recipient-section">
                        <div className="message-recipient-section-head">
                          <div>
                            <strong>{section.label}</strong>
                            <p>{section.helperText}</p>
                          </div>
                          <span className="chip">{section.people.length}</span>
                        </div>

                        <div className="message-recipient-grid">
                          {section.people.map((person) => (
                            <span key={person.id} className="message-recipient-pill">
                              <span>{person.firstName} {person.lastName}</span>
                              <StatusBadge
                                label={section.badgeLabel}
                                tone={section.badgeTone}
                              />
                            </span>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}

                {activeMessageThread ? (
                  <section className="message-thread-panel">
                    <div className="message-thread-panel-head">
                      <div>
                        <strong>Conversation history</strong>
                        <p>
                          {activeMessageThread.messageCount} message
                          {activeMessageThread.messageCount === 1 ? "" : "s"} in
                          this thread
                        </p>
                      </div>
                      <a
                        className="button ghost"
                        href={`/staff-app/scm/live/${gigId}/messages/${activeMessageThread.id}`}
                      >
                        Open in SCM STAFF app
                      </a>
                    </div>

                    <div className="message-thread-history">
                      {activeMessageThread.messages.map((message) => (
                        <article
                          key={message.id}
                          className={`message-thread-bubble ${
                            message.authorType === "staff" ? "incoming" : "outgoing"
                          }`}
                        >
                          <strong>{message.authorName?.trim() || "SCM"}</strong>
                          {message.body ? <p>{message.body}</p> : null}
                          {(message.attachments?.length ?? 0) > 0 ? (
                            <div className="message-log-attachments">
                              {message.attachments?.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="message-log-attachment"
                                >
                                  {attachment.fileName}
                                  <span>{formatFileSize(attachment.fileSize)}</span>
                                </a>
                              ))}
                            </div>
                          ) : null}
                          <small>
                            {new Date(message.createdAt).toLocaleString("en-GB")}
                          </small>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <form className="message-compose-form" onSubmit={handleSendMessage}>
                  {messageDraftTarget.audience === "bookedOnShift" ? (
                    <div className="message-broadcast-note">
                      This goes out as a one-way broadcast. Staff can read the
                      message and open attachments, but they cannot reply.
                    </div>
                  ) : activeMessageThread ? (
                    <div className="message-broadcast-note">
                      Replies stay inside this thread and remain visible in both SCM
                      and the staff app.
                    </div>
                  ) : null}

                  <label className="field">
                    <span>Message draft</span>
                    <textarea
                      value={messageBody}
                      onChange={(event) => setMessageBody(event.target.value)}
                      placeholder={
                        activeMessageThread
                          ? "Continue this conversation here."
                          : "Write shift-level communication here."
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Attachments</span>
                    <input
                      key={messageAttachmentInputKey}
                      type="file"
                      multiple
                      accept={messageAttachmentAccept}
                      onChange={handleMessageAttachmentSelection}
                    />
                    <p className="helper-caption">
                      Add PDFs, pictures, and common office files when needed.
                    </p>
                  </label>

                  {messageAttachments.length > 0 ? (
                    <div className="message-attachment-list">
                      {messageAttachments.map((file) => (
                        <div
                          key={buildMessageAttachmentSignature(file)}
                          className="message-attachment-item"
                        >
                          <div>
                            <strong>{file.name}</strong>
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                          <button
                            type="button"
                            className="button ghost"
                            onClick={() => handleRemoveMessageAttachment(file)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {messageError ? <p className="form-error">{messageError}</p> : null}

                  <div className="message-compose-actions">
                    <button
                      type="submit"
                      className="button"
                      disabled={isSendingMessage}
                    >
                      {isSendingMessage
                        ? "Saving..."
                        : activeMessageThread
                          ? "Send reply"
                          : "Save message"}
                    </button>
                  </div>
                </form>
              </section>
            </section>

            <section className="message-column message-column-secondary">
              <section className="message-log message-log-panel">
                <div className="section-head compact">
                  <div>
                    <p className="eyebrow">Open conversations</p>
                    <h3>All communication</h3>
                  </div>
                  <span className="chip">
                    {messageConversationThreads.length} open
                  </span>
                </div>

                {messageConversationThreads.length === 0 ? (
                  <div className="empty-panel">
                    No conversations have been opened for this gig yet.
                  </div>
                ) : (
                  <div className="message-log-list">
                    {messageConversationThreads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        className={`message-log-item message-thread-list-item ${
                          activeMessageThread?.id === thread.id ? "active" : ""
                        }`}
                        onClick={() => handleOpenMessageThread(thread.id)}
                      >
                        <div className="message-log-head">
                          <strong>{thread.title}</strong>
                          <div className="message-log-meta">
                            <span className="chip">
                              {thread.recipientIds.length} recipients
                            </span>
                            <span className="chip chip-soft">
                              {thread.messageCount} message
                              {thread.messageCount === 1 ? "" : "s"}
                            </span>
                            {thread.allowReplies === false ? (
                              <span className="chip chip-soft">Replies off</span>
                            ) : (
                              <span className="chip chip-soft">Replies on</span>
                            )}
                          </div>
                        </div>
                        <p>{thread.preview}</p>
                        <small>
                          {thread.latestMessage.authorName?.trim() || "SCM"} |{" "}
                          {new Date(thread.lastActivityAt).toLocaleString("en-GB")}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </section>
          </div>
        </section>
      ) : null}

      {shiftPendingDelete ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-shift-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Delete shift</p>
                <h2 id="delete-shift-title">Remove this shift?</h2>
                <p className="page-subtitle">
                  Delete <strong>{shiftPendingDelete.role}</strong> from{" "}
                  <strong>
                    {shiftPendingDelete.startTime} to {shiftPendingDelete.endTime}
                  </strong>
                  . This removes the shift from the gig and unlinks its bookings.
                </p>
              </div>

              {deleteShiftError ? <p className="form-error">{deleteShiftError}</p> : null}

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={handleCancelDeleteShift}
                  disabled={isDeletingShift}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button danger"
                  onClick={() => {
                    void handleConfirmDeleteShift();
                  }}
                  disabled={isDeletingShift}
                >
                  {isDeletingShift ? "Deleting..." : "Confirm delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}
