import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureProductionStorageSchema,
  getPostgresClient,
  parseJsonValue,
  serializeJson,
} from "@/lib/postgres";
import type { StaffApplicationApprovalEmailTemplate } from "@/types/job-applications";

interface StoredSystemEmailTemplateState {
  approvedApplication: StaffApplicationApprovalEmailTemplate;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-email-template-store.json");

const approvalTemplateFieldKeys = [
  "subject",
  "preheader",
  "headline",
  "intro",
  "body",
  "ctaLabel",
  "expiryNotice",
  "helpText",
  "signature",
  "footerText",
  "supportEmail",
] as const satisfies ReadonlyArray<keyof StaffApplicationApprovalEmailTemplate>;

function createLegacyApprovedApplicationEmailTemplate(): StaffApplicationApprovalEmailTemplate {
  return {
    id: "approvedApplication",
    label: "Approved application",
    description:
      "Email sent when a Work at SCM application is approved and the applicant should create a password.",
    subject: "Din ansokan till SCM har blivit godkand",
    preheader: "Skapa ditt losenord och aktivera ditt konto inom 24 timmar.",
    headline: "Valkommen till SCM, {{name}}",
    intro:
      "Din ansokan har blivit godkand. Nu ar det dags att skapa ditt losenord och aktivera ditt konto i SCM Staff App.",
    body:
      "Klicka pa knappen nedan for att skapa ditt losenord. Av sakerhetsskal skickar vi aldrig losenord via email.\n\nNar losenordet ar skapat blir ditt konto aktivt direkt och du kan logga in i appen.",
    ctaLabel: "Skapa ditt losenord",
    expiryNotice:
      "Lanken ar giltig till {{expiresAt}}. Om lanken har slutat galla, maila {{supportEmail}} eller kontakta din narmaste chef.",
    helpText:
      "Om du inte forvantade dig det har mailet kan du ignorera det. Ingen andring sker forran du skapar ditt losenord.",
    signature: "Vanliga halsningar,\nSCM Team",
    footerText:
      "Detta ar ett automatiskt utskick fran SCM. Om du behover hjalp svarar du enklast via {{supportEmail}}.",
    supportEmail: "INFO@scm.se",
  };
}

function createDefaultApprovedApplicationEmailTemplate(): StaffApplicationApprovalEmailTemplate {
  return {
    id: "approvedApplication",
    label: "Approved application",
    description:
      "Email sent when a Work at SCM application is approved and the applicant should create a password.",
    subject: "Your SCM application has been approved",
    preheader: "Create your password and activate your account within 24 hours.",
    headline: "Welcome to SCM, {{name}}",
    intro:
      "Your application has been approved. The next step is to create your password and activate your account in the SCM Staff App.",
    body:
      "Click the button below to create your password. For security reasons, we never send passwords by email.\n\nOnce your password has been created, your account will be active immediately and you can sign in to the app.",
    ctaLabel: "Create your password",
    expiryNotice:
      "This link is valid until {{expiresAt}}. If it has expired, email {{supportEmail}} or contact your nearest manager.",
    helpText:
      "If you were not expecting this email, you can safely ignore it. No changes will be made until you create your password.",
    signature: "Best regards,\nSCM Team",
    footerText:
      "This is an automated email from SCM. If you need help, please contact {{supportEmail}}.",
    supportEmail: "INFO@scm.se",
  };
}

function normalizeApprovedApplicationTemplate(
  template: Partial<StaffApplicationApprovalEmailTemplate> | undefined,
) {
  const defaults = createDefaultApprovedApplicationEmailTemplate();
  const legacyDefaults = createLegacyApprovedApplicationEmailTemplate();
  const normalizedTemplate = {
    ...defaults,
    ...template,
    id: "approvedApplication",
  } satisfies StaffApplicationApprovalEmailTemplate;

  for (const fieldKey of approvalTemplateFieldKeys) {
    if (template?.[fieldKey] === legacyDefaults[fieldKey]) {
      normalizedTemplate[fieldKey] = defaults[fieldKey];
    }
  }

  return normalizedTemplate;
}

function createDefaultSystemEmailTemplateState(): StoredSystemEmailTemplateState {
  return {
    approvedApplication: createDefaultApprovedApplicationEmailTemplate(),
  };
}

async function ensureSystemEmailTemplateStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(createDefaultSystemEmailTemplateState(), null, 2),
      "utf8",
    );
  }
}

async function readSystemEmailTemplateStoreSnapshot() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredSystemEmailTemplateState>;

    return {
      approvedApplication: normalizeApprovedApplicationTemplate(parsed.approvedApplication),
    } satisfies StoredSystemEmailTemplateState;
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return createDefaultSystemEmailTemplateState();
    }

    throw error;
  }
}

async function readSystemEmailTemplateStore() {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<{ template_json: string }[]>`
      select template_json
      from system_email_templates
      where id = 'approvedApplication'
      limit 1
    `;

    if (!rows[0]?.template_json) {
      const fallbackState = await readSystemEmailTemplateStoreSnapshot();

      await sql`
        insert into system_email_templates (id, template_json, updated_at)
        values (
          'approvedApplication',
          ${serializeJson(fallbackState.approvedApplication)},
          ${new Date().toISOString()}
        )
        on conflict (id) do nothing
      `;

      return fallbackState;
    }

    return {
      approvedApplication: normalizeApprovedApplicationTemplate(
        parseJsonValue<Partial<StaffApplicationApprovalEmailTemplate>>(
          rows[0]?.template_json,
          {},
        ),
      ),
    } satisfies StoredSystemEmailTemplateState;
  }

  await ensureSystemEmailTemplateStore();
  return readSystemEmailTemplateStoreSnapshot();
}

export async function getSystemEmailTemplateState() {
  return readSystemEmailTemplateStore();
}

export async function getApprovedApplicationEmailTemplate() {
  return (await readSystemEmailTemplateStore()).approvedApplication;
}

export async function updateApprovedApplicationEmailTemplate(
  nextTemplate: StaffApplicationApprovalEmailTemplate,
) {
  const currentState = await readSystemEmailTemplateStore();
  const nextState: StoredSystemEmailTemplateState = {
    ...currentState,
    approvedApplication: {
      ...currentState.approvedApplication,
      ...nextTemplate,
      id: "approvedApplication",
    },
  };

  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    await sql`
      insert into system_email_templates (id, template_json, updated_at)
      values (
        'approvedApplication',
        ${serializeJson(nextState.approvedApplication)},
        ${new Date().toISOString()}
      )
      on conflict (id) do update set
        template_json = excluded.template_json,
        updated_at = excluded.updated_at
    `;
    return nextState.approvedApplication;
  }

  await fs.writeFile(storePath, JSON.stringify(nextState, null, 2), "utf8");
  return nextState.approvedApplication;
}
