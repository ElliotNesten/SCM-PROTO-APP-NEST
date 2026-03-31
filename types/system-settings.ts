export type ShiftPdfTemplateId = "employmentContract" | "timeReport";

export type ShiftPdfPlaceholderKey =
  | "documentKind"
  | "gigName"
  | "gigDate"
  | "shiftRole"
  | "generatedDate"
  | "referenceId";

export interface ShiftPdfTemplateContext {
  documentKind: string;
  gigName: string;
  gigDate: string;
  shiftRole: string;
  generatedDate: string;
  referenceId: string;
}

export interface ShiftPdfTemplate {
  id: ShiftPdfTemplateId;
  label: string;
  description: string;
  title: string;
  intro: string;
  footer: string;
  enabledPlaceholders: ShiftPdfPlaceholderKey[];
}

export const shiftPdfTemplateIds: ShiftPdfTemplateId[] = [
  "employmentContract",
  "timeReport",
];

export const shiftPdfPlaceholderOrder: ShiftPdfPlaceholderKey[] = [
  "gigName",
  "gigDate",
  "shiftRole",
  "generatedDate",
  "referenceId",
  "documentKind",
];

export const shiftPdfPlaceholderDefinitions: Record<
  ShiftPdfPlaceholderKey,
  { label: string; valuePrefix: string }
> = {
  documentKind: {
    label: "Document kind",
    valuePrefix: "Document",
  },
  gigName: {
    label: "Gig name",
    valuePrefix: "Gig",
  },
  gigDate: {
    label: "Gig date",
    valuePrefix: "Date",
  },
  shiftRole: {
    label: "Shift role",
    valuePrefix: "Shift",
  },
  generatedDate: {
    label: "Generated date",
    valuePrefix: "Generated",
  },
  referenceId: {
    label: "Reference ID",
    valuePrefix: "Reference",
  },
};

export const defaultShiftPdfTemplates: Record<
  ShiftPdfTemplateId,
  ShiftPdfTemplate
> = {
  employmentContract: {
    id: "employmentContract",
    label: "Employment Contract",
    description: "Template used when a shift creates an employment contract PDF.",
    title: "Employment Contract",
    intro: "This agreement confirms the staff assignment for the selected SCM gig.",
    footer: "Generated from the current approved system template.",
    enabledPlaceholders: [
      "gigName",
      "gigDate",
      "shiftRole",
      "generatedDate",
      "referenceId",
    ],
  },
  timeReport: {
    id: "timeReport",
    label: "Time Report",
    description: "Template used when an approved time report PDF is generated.",
    title: "Time Report",
    intro: "This report summarizes the completed shift and the approved work entry.",
    footer: "Generated from the current approved system template.",
    enabledPlaceholders: [
      "gigName",
      "gigDate",
      "shiftRole",
      "generatedDate",
      "referenceId",
    ],
  },
};

function normalizeEnabledPlaceholders(
  enabledPlaceholders: ShiftPdfPlaceholderKey[],
) {
  return shiftPdfPlaceholderOrder.filter((placeholderKey, index, array) => {
    return enabledPlaceholders.includes(placeholderKey) && array.indexOf(placeholderKey) === index;
  });
}

export function normalizeShiftPdfTemplate(
  template: ShiftPdfTemplate,
): ShiftPdfTemplate {
  const fallback = defaultShiftPdfTemplates[template.id];

  return {
    ...fallback,
    ...template,
    title: template.title.trim() || fallback.title,
    intro: template.intro.trim(),
    footer: template.footer.trim(),
    enabledPlaceholders:
      normalizeEnabledPlaceholders(template.enabledPlaceholders).length > 0
        ? normalizeEnabledPlaceholders(template.enabledPlaceholders)
        : fallback.enabledPlaceholders,
  };
}

export function buildShiftPdfTemplateLines(
  template: ShiftPdfTemplate,
  context: ShiftPdfTemplateContext,
) {
  const normalizedTemplate = normalizeShiftPdfTemplate(template);
  const lines: string[] = [normalizedTemplate.title];

  if (normalizedTemplate.intro) {
    lines.push(normalizedTemplate.intro);
  }

  normalizedTemplate.enabledPlaceholders.forEach((placeholderKey) => {
    const definition = shiftPdfPlaceholderDefinitions[placeholderKey];
    const placeholderValue = context[placeholderKey];

    if (!placeholderValue?.trim()) {
      return;
    }

    lines.push(`${definition.valuePrefix}: ${placeholderValue}`);
  });

  if (normalizedTemplate.footer) {
    lines.push(normalizedTemplate.footer);
  }

  return lines;
}

export function createShiftPdfPreviewContext(
  templateId: ShiftPdfTemplateId,
): ShiftPdfTemplateContext {
  const documentKind =
    templateId === "employmentContract" ? "Employment Contract" : "Time Report";

  return {
    documentKind,
    gigName: "Melo North",
    gigDate: "12 Apr 2026",
    shiftRole: "Stand Leader",
    generatedDate: "12 Apr 2026",
    referenceId: `${templateId}-preview-001`,
  };
}
