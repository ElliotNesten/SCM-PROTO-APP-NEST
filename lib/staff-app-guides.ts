import { equipmentOptions } from "@/data/equipment-options";

export type StaffAppGuideEntry = {
  title: string;
  subtitle: string;
  body: string;
};

const equipmentSummary = equipmentOptions.map((item) => item.label).join(", ");

export const staffAppRolesTrainingGuides: StaffAppGuideEntry[] = [
  {
    title: "Seller",
    subtitle: "Sales flow, customer service, and stand routines.",
    body:
      "Greet guests quickly, keep the queue moving, confirm pricing before each sale, and report low stock in the shift chat as soon as it affects service.",
  },
  {
    title: "Stand Leader",
    subtitle: "Briefing, delegation, and on-floor escalation.",
    body:
      "Run the pre-door briefing, assign stand zones, monitor floats and stock levels, and escalate venue issues to the responsible manager without delay.",
  },
  {
    title: "Other Info",
    subtitle: "Shared expectations across every approved SCM role.",
    body:
      "Follow meeting times, uniform instructions, and shift notes, use Check In / Out on the live shift day, and keep all practical questions in the linked shift thread.",
  },
];

export const staffAppChecklistGuides: StaffAppGuideEntry[] = [
  {
    title: "Gig Checklist",
    subtitle: "What to confirm before you leave for the venue.",
    body:
      "Review shift notes, confirm your meeting point and manager, charge your phone, pack your uniform, and make sure you can access the right documents before departure.",
  },
  {
    title: "Equipment",
    subtitle: "Core setup items to verify on site.",
    body: `When relevant to the venue, confirm the pack includes ${equipmentSummary}. Report missing setup items before doors open.`,
  },
  {
    title: "Tent",
    subtitle: "Outdoor setup and weather-readiness basics.",
    body:
      "For outdoor sales areas, confirm anchoring, weather cover, lighting, and safe walkways before opening so the setup stays compliant and safe.",
  },
  {
    title: "Info Letter",
    subtitle: "Operational notes you should read before arrival.",
    body:
      "Read the event info letter ahead of time so you know access route, doors time, sales setup, and any promoter-specific instructions that affect the shift.",
  },
];

export const staffAppPlatformGuides: StaffAppGuideEntry[] = [
  {
    title: "Contact",
    subtitle: "Who to contact during a running shift.",
    body:
      "Use the shift-linked chat first. For urgent operational issues, contact the responsible manager or project lead shown in your shift details.",
  },
  {
    title: "FAQ",
    subtitle: "Quick answers to common staff questions.",
    body:
      "If you are unsure about timing, role scope, attendance, or documents, check the relevant guide first and then escalate in the shift thread if something is still unclear.",
  },
  {
    title: "News",
    subtitle: "Current notices from SCM operations.",
    body:
      "Latest process updates, operational reminders, and rollout notes are shared here in the staff app and by your managers when something changes.",
  },
];

export const staffAppCashCardGuides: StaffAppGuideEntry[] = [
  {
    title: "Cash Handling",
    subtitle: "Floats, counting, and reconciliation.",
    body:
      "Count floats with a lead, never leave open cash unattended, and reconcile any differences before signing off at the end of the shift.",
  },
  {
    title: "Card Terminals",
    subtitle: "Startup, charging, and connectivity.",
    body:
      "Check battery level, connectivity, receipt settings, and a payment test before doors. Report terminal issues immediately so the stand can stay live.",
  },
  {
    title: "Closeout",
    subtitle: "What must happen before tills are returned.",
    body:
      "Run end-of-shift totals, return tills and accessories to the agreed handoff point, and confirm that time reporting matches the actual finish time.",
  },
];
