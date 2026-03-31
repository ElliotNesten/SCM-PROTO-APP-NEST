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

  const account = await getStaffAppAccountById(verification.record.staffAppAccountId);

  if (!account) {
    return {
      ok: false as const,
      error: "The staff account connected to this token could not be found.",
      status: 404,
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

  await consumePasswordSetupToken(input.token);

  return {
    ok: true as const,
    account: activatedAccount,
    tokenRecord: verification.record,
  };
}
