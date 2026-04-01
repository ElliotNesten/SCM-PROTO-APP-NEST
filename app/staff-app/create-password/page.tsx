import { CreatePasswordForm } from "@/components/staff-app/create-password-form";
import { verifyPasswordSetupToken } from "@/lib/password-setup-token-store";

type CreatePasswordPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

function pickValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CreatePasswordPage({
  searchParams,
}: CreatePasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const token = pickValue(resolvedSearchParams?.token);
  const verification = await verifyPasswordSetupToken(token);

  return (
    <div className="staff-app-shell login">
      <div className="staff-app-device login">
        <section className="staff-app-login-screen">
          <CreatePasswordForm
            token={token}
            verificationState={verification.state}
            subjectType={verification.record?.subjectType ?? "staffApp"}
            email={verification.record?.email ?? ""}
            expiresAt={verification.record?.expiresAt ?? null}
          />
        </section>
      </div>
    </div>
  );
}
