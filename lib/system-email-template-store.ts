import fs from "node:fs/promises";
import path from "node:path";

import type { StaffApplicationApprovalEmailTemplate } from "@/types/job-applications";

interface StoredSystemEmailTemplateState {
  approvedApplication: StaffApplicationApprovalEmailTemplate;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-email-template-store.json");

function createDefaultSystemEmailTemplateState(): StoredSystemEmailTemplateState {
  return {
    approvedApplication: {
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
    },
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

async function readSystemEmailTemplateStore() {
  await ensureSystemEmailTemplateStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredSystemEmailTemplateState>;
  const defaults = createDefaultSystemEmailTemplateState();

  return {
    approvedApplication: {
      ...defaults.approvedApplication,
      ...parsed.approvedApplication,
      id: "approvedApplication",
    },
  } satisfies StoredSystemEmailTemplateState;
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

  await fs.writeFile(storePath, JSON.stringify(nextState, null, 2), "utf8");
  return nextState.approvedApplication;
}
