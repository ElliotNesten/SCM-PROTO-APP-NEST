import type {
  Gig,
  GigOverviewIndicator,
  GigStatus,
  GigTab,
  OpsSignal,
  RouteTab,
  Shift,
  ShiftTab,
  StaffMember,
} from "@/types/scm";
import { staffDirectory } from "@/data/backend-user-data";

export const primaryNav = [
  {
    label: "Dashboard",
    href: "/dashboard",
    description: "Operational overview",
  },
  {
    label: "Gigs",
    href: "/gigs",
    description: "Gig lifecycle and staffing",
  },
  {
    label: "SCM Staff",
    href: "/scm-staff",
    description: "Role-based platform access and admin scopes",
  },
  {
    label: "Staff",
    href: "/people",
    description: "Staff registry and applicant profiles",
  },
  {
    label: "Profile",
    href: "/profile",
    description: "Personal records and documents",
  },
] as const;

export const gigTabs: RouteTab<GigTab>[] = [
  { slug: "overview", label: "Overview" },
  { slug: "files", label: "Files & info" },
  { slug: "shifts", label: "Shifts" },
  { slug: "reports", label: "Reports" },
  { slug: "closeout", label: "Close gig" },
];

export const shiftTabs: RouteTab<ShiftTab>[] = [
  { slug: "overview", label: "Overview" },
  { slug: "booking", label: "Staff Booking" },
  { slug: "messages", label: "Messages" },
];

export const shiftDetailTabs: RouteTab<ShiftTab>[] = [
  { slug: "overview", label: "Overview" },
  { slug: "booking", label: "Staff Booking" },
];

export const gigLifecycle = [
  "Identified",
  "Planning",
  "Published",
  "Confirmed",
  "Completed",
  "Reported",
  "Closed",
] as const satisfies readonly GigStatus[];

export const createGigSteps = [
  "Basics",
  "Operations",
  "Notes",
  "Equipment",
  "Files",
  "Review",
] as const;

export const gigs: Gig[] = [
  {
    id: "gig-1",
    artist: "Melo North",
    arena: "Avicii Arena",
    city: "Stockholm",
    country: "Sweden",
    region: "Stockholm",
    date: "2026-04-12",
    startTime: "16:00",
    endTime: "23:30",
    promoter: "Live Nation",
    merchCompany: "SCM",
    merchRepresentative: "Anna Reid",
    scmRepresentative: "Anton",
    ticketsSold: 12000,
    estimatedSpendPerVisitor: 145,
    status: "Planning",
    progress: 58,
    staffingProgress: 64,
    alertCount: 2,
    notes: "High traffic expected before doors.",
  },
  {
    id: "gig-2",
    artist: "Neon Hearts",
    arena: "Scandinavium",
    city: "Gothenburg",
    country: "Sweden",
    region: "West",
    date: "2026-04-18",
    startTime: "15:00",
    endTime: "23:00",
    promoter: "AEG",
    merchCompany: "SCM",
    merchRepresentative: "Marcus Cole",
    scmRepresentative: "Emilio",
    ticketsSold: 9800,
    estimatedSpendPerVisitor: 132,
    status: "Published",
    progress: 72,
    staffingProgress: 81,
    alertCount: 1,
    notes: "Program seller setup at main concourse.",
  },
  {
    id: "gig-3",
    artist: "Fjord Echo",
    arena: "Oslo Spektrum",
    city: "Oslo",
    country: "Norway",
    region: "Oslo",
    date: "2026-04-21",
    startTime: "14:00",
    endTime: "22:30",
    promoter: "Nordic Events",
    merchCompany: "SCM",
    merchRepresentative: "Siri Halden",
    scmRepresentative: "Sandra",
    ticketsSold: 8300,
    estimatedSpendPerVisitor: 121,
    status: "Confirmed",
    progress: 46,
    staffingProgress: 39,
    alertCount: 3,
    notes: "Need extra runners for load out.",
  },
  {
    id: "gig-4",
    artist: "Royal Static",
    arena: "Royal Arena",
    city: "Copenhagen",
    country: "Denmark",
    region: "Capital",
    date: "2026-04-25",
    startTime: "15:30",
    endTime: "23:00",
    promoter: "Stage Nordic",
    merchCompany: "SCM",
    merchRepresentative: "Nora Beck",
    scmRepresentative: "Daniel",
    ticketsSold: 15000,
    estimatedSpendPerVisitor: 158,
    status: "Investigating",
    progress: 21,
    staffingProgress: 0,
    alertCount: 4,
    notes: "Awaiting final promoter confirmation.",
  },
  {
    id: "gig-5",
    artist: "Signal Fire",
    arena: "Malmo Arena",
    city: "Malmo",
    country: "Sweden",
    region: "South",
    date: "2026-05-02",
    startTime: "16:30",
    endTime: "23:45",
    promoter: "Arena Touring",
    merchCompany: "SCM",
    merchRepresentative: "Leo Hart",
    scmRepresentative: "Anton",
    ticketsSold: 10100,
    estimatedSpendPerVisitor: 138,
    status: "Identified",
    progress: 12,
    staffingProgress: 0,
    alertCount: 1,
    notes: "Draft only.",
  },
];

export const shifts: Shift[] = [
  {
    id: "shift-1",
    gigId: "gig-1",
    role: "Stand Leader",
    priorityLevel: 1,
    startTime: "15:00",
    endTime: "23:30",
    requiredStaff: 2,
    notes: "Lead main floor stands.",
    skillRequirement: "Experienced arena lead",
    priorityTag: "High",
    assignments: [
      { staffId: "staff-1", bookingStatus: "Confirmed" },
      { staffId: "staff-2", bookingStatus: "Pending" },
    ],
  },
  {
    id: "shift-2",
    gigId: "gig-1",
    role: "Seller",
    priorityLevel: 2,
    startTime: "16:00",
    endTime: "22:45",
    requiredStaff: 8,
    notes: "Main sales team.",
    skillRequirement: "POS knowledge",
    priorityTag: "High",
    assignments: [
      { staffId: "staff-3", bookingStatus: "Confirmed" },
      { staffId: "staff-4", bookingStatus: "Confirmed" },
      { staffId: "staff-5", bookingStatus: "Waitlisted" },
    ],
  },
  {
    id: "shift-3",
    gigId: "gig-1",
    role: "Runner",
    priorityLevel: 3,
    startTime: "14:00",
    endTime: "23:30",
    requiredStaff: 3,
    notes: "Stock refills and support.",
    priorityTag: "Medium",
    assignments: [{ staffId: "staff-6", bookingStatus: "Confirmed" }],
  },
  {
    id: "shift-4",
    gigId: "gig-2",
    role: "Stand Leader",
    priorityLevel: 1,
    startTime: "14:30",
    endTime: "23:00",
    requiredStaff: 1,
    notes: "West entrance zone.",
    priorityTag: "High",
    assignments: [{ staffId: "staff-7", bookingStatus: "Confirmed" }],
  },
  {
    id: "shift-5",
    gigId: "gig-2",
    role: "Seller",
    priorityLevel: 2,
    startTime: "16:00",
    endTime: "22:30",
    requiredStaff: 6,
    notes: "Mobile sellers included.",
    priorityTag: "Medium",
    assignments: [
      { staffId: "staff-1", bookingStatus: "Confirmed" },
      { staffId: "staff-8", bookingStatus: "Pending" },
    ],
  },
  {
    id: "shift-6",
    gigId: "gig-2",
    role: "Runner",
    priorityLevel: 3,
    startTime: "15:00",
    endTime: "23:15",
    requiredStaff: 2,
    notes: "Back of house replenishment.",
    priorityTag: "Medium",
    assignments: [{ staffId: "staff-9", bookingStatus: "Confirmed" }],
  },
  {
    id: "shift-7",
    gigId: "gig-3",
    role: "Stand Leader",
    priorityLevel: 1,
    startTime: "14:00",
    endTime: "22:30",
    requiredStaff: 1,
    notes: "Oslo floor lead.",
    priorityTag: "High",
    assignments: [],
  },
  {
    id: "shift-8",
    gigId: "gig-3",
    role: "Seller",
    priorityLevel: 2,
    startTime: "15:00",
    endTime: "22:00",
    requiredStaff: 5,
    notes: "Front concourse sales.",
    priorityTag: "Medium",
    assignments: [{ staffId: "staff-10", bookingStatus: "Pending" }],
  },
  {
    id: "shift-9",
    gigId: "gig-3",
    role: "Runner",
    priorityLevel: 3,
    startTime: "14:30",
    endTime: "22:30",
    requiredStaff: 2,
    notes: "Warehouse and stand support.",
    priorityTag: "Medium",
    assignments: [],
  },
  {
    id: "shift-10",
    gigId: "gig-4",
    role: "Stand Leader",
    priorityLevel: 1,
    startTime: "15:00",
    endTime: "23:00",
    requiredStaff: 1,
    notes: "Awaiting confirmation.",
    priorityTag: "High",
    assignments: [],
  },
  {
    id: "shift-11",
    gigId: "gig-4",
    role: "Seller",
    priorityLevel: 2,
    startTime: "16:00",
    endTime: "22:30",
    requiredStaff: 7,
    notes: "Draft staffing.",
    priorityTag: "Medium",
    assignments: [],
  },
  {
    id: "shift-12",
    gigId: "gig-4",
    role: "Runner",
    priorityLevel: 3,
    startTime: "15:00",
    endTime: "23:00",
    requiredStaff: 3,
    notes: "Draft staffing.",
    priorityTag: "Low",
    assignments: [],
  },
  {
    id: "shift-13",
    gigId: "gig-5",
    role: "Stand Leader",
    priorityLevel: 1,
    startTime: "15:30",
    endTime: "23:45",
    requiredStaff: 1,
    notes: "Not yet published.",
    priorityTag: "High",
    assignments: [],
  },
  {
    id: "shift-14",
    gigId: "gig-5",
    role: "Seller",
    priorityLevel: 2,
    startTime: "16:30",
    endTime: "23:00",
    requiredStaff: 5,
    notes: "Not yet published.",
    priorityTag: "Medium",
    assignments: [],
  },
  {
    id: "shift-15",
    gigId: "gig-5",
    role: "Runner",
    priorityLevel: 3,
    startTime: "15:30",
    endTime: "23:45",
    requiredStaff: 2,
    notes: "Not yet published.",
    priorityTag: "Low",
    assignments: [],
  },
];

export const staff: StaffMember[] = staffDirectory;

export const opsSignals: OpsSignal[] = [
  {
    title: "Royal Static still needs promoter confirmation",
    detail: "Keep the gig internal until the promoter lock is in place.",
    tone: "warn",
  },
  {
    title: "Fjord Echo is short on runners",
    detail: "Open slots remain across load-in and load-out coverage.",
    tone: "danger",
  },
  {
    title: "Neon Hearts staffing is nearly complete",
    detail: "Good candidate for operational handoff and final file prep.",
    tone: "success",
  },
  {
    title: "Signal Fire should stay in draft mode",
    detail: "Use this project to flesh out the new gig creation workflow.",
    tone: "info",
  },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function getGigById(gigId: string) {
  return gigs.find((gig) => gig.id === gigId);
}

export function getShiftById(shiftId: string) {
  return shifts.find((shift) => shift.id === shiftId);
}

export function getGigShifts(gigId: string) {
  return shifts.filter((shift) => shift.gigId === gigId);
}

export function getAssignedStaffForGig(gigId: string) {
  const assignedIds = new Set(
    getGigShifts(gigId).flatMap((shift) =>
      shift.assignments.map((assignment) => assignment.staffId),
    ),
  );

  return staff.filter((person) => assignedIds.has(person.id));
}

export function getAvailableStaffForShift(gig: Gig, shift: Shift) {
  return staff.filter(
    (person) =>
      person.country === gig.country &&
      person.roles.includes(shift.role) &&
      person.priority <= shift.priorityLevel &&
      person.approvalStatus !== "Archived",
  );
}

export function getConfirmedCount(shift: Shift) {
  return shift.assignments.filter(
    (assignment) => assignment.bookingStatus === "Confirmed",
  ).length;
}

export function getWaitlistCount(shift: Shift) {
  return shift.assignments.filter(
    (assignment) => assignment.bookingStatus === "Waitlisted",
  ).length;
}

export function getOpenSlots(shift: Shift) {
  return Math.max(shift.requiredStaff - getConfirmedCount(shift), 0);
}

export function getGigSalesEstimate(gig: Gig) {
  return gig.salesEstimateOverride ?? gig.ticketsSold * gig.estimatedSpendPerVisitor;
}

export function resolveGigOverviewIndicator(gig: Pick<Gig, "overviewIndicator" | "status">) {
  if (gig.overviewIndicator) {
    return gig.overviewIndicator;
  }

  if (gig.status === "Confirmed") {
    return "confirmed";
  }

  if (gig.status === "Identified") {
    return "identified";
  }

  return "inProgress" satisfies GigOverviewIndicator;
}

export function getCountryBreakdown() {
  return ["Sweden", "Norway", "Denmark"].map((country) => ({
    country,
    gigs: gigs.filter((gig) => gig.country === country).length,
  }));
}
