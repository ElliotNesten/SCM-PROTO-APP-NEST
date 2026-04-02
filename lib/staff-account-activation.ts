import { createPasswordHash } from "@/lib/password-utils";
import {
  getStoredScmStaffProfileById,
  updateStoredScmStaffProfile,
} from "@/lib/scm-staff-store";
import { activateStaffAppAccountById, getStaffAppAccountById } from "@/lib/staff-app-store";
import {
  consumePasswordSetupToken,
  verifyPasswordSetupToken,
} from "@/lib/password-setup-token-store";
import { updateStoredStaffProfile } from "@/lib/staff-store";

export async function activateStaffAccountWithPassword(input: {
  token: string;
  password: string;
}) {
  const normalizedPassword = input.password.trim();

  if (normalizedPassword.length < 8) {
    return {
      ok: false as const,
      error: "Password must be at least 8 characters long.",
      status: 400,
    };
  }

  const verification = await verifyPasswordSetupToken(input.token);

  if (verification.state !== "valid" || !verification.record) {
    return {
      ok: false as const,
      error:
        verification.state === "expired"
          ? "This password link has expired."
          : verification.state === "consumed"
            ? "This password link has already been used."
            : verification.state === "invalidated"
              ? "This password link is no longer valid."
              : "This password link is invalid.",
      status: verification.state === "missing" ? 404 : 400,
    };
  }

  const subjectType = verification.record.subjectType ?? "staffApp";

  if (subjectType === "scmStaff") {
    const scmStaffProfileId =
      verification.record.scmStaffProfileId ?? verification.record.staffProfileId;
    const profile = await getStoredScmStaffProfileById(scmStaffProfileId);

    if (!profile) {
      return {
        ok: false as const,
        error: "The SCM Staff account connected to this token could not be found.",
        status: 404,
      };
    }

    const consumedTokenRecord = await consumePasswordSetupToken(input.token);

    if (!consumedTokenRecord) {
      return {
        ok: false as const,
        error: "This password link has already been used.",
        status: 400,
      };
    }

    const updatedProfile = await updateStoredScmStaffProfile(profile.id, {
      passwordHash: createPasswordHash(normalizedPassword),
    });

    if (!updatedProfile) {
      return {
        ok: false as const,
        error: "The SCM Staff account connected to this token could not be activated.",
        status: 404,
      };
    }

    return {
      ok: true as const,
      subjectType: "scmStaff" as const,
      profile: updatedProfile,
      tokenRecord: consumedTokenRecord,
    };
  }

  const account = await getStaffAppAccountById(verification.record.staffAppAccountId);

  if (!account) {
    return {
      ok: false as const,
      error: "The staff account connected to this token could not be found.",
      status: 404,
    };
  }

  const consumedTokenRecord = await consumePasswordSetupToken(input.token);

  if (!consumedTokenRecord) {
    return {
      ok: false as const,
      error: "This password link has already been used.",
      status: 400,
    };
  }

  const activatedAccount = await activateStaffAppAccountById(account.id, normalizedPassword);

  if (!activatedAccount) {
    return {
      ok: false as const,
      error: "The staff account connected to this token could not be activated.",
      status: 404,
    };
  }

  await updateStoredStaffProfile(verification.record.staffProfileId, {
    registrationStatus: "ACTIVATED",
    approvalStatus: "Approved",
    profileApproved: true,
  });

  return {
    ok: true as const,
    subjectType: "staffApp" as const,
    account: activatedAccount,
    tokenRecord: consumedTokenRecord,
  };
}
