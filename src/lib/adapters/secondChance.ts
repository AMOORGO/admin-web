import type { BadgeVariant } from "@/components/Badge";
import { humanize } from "@/lib/format";
import type { ApiAvailability, ApiCaptainStatus } from "./captains";

/**
 * Second Chance adapters. Typed from GET /admin/second-chance, /stats and /:captainId (backend second-chance.service.ts mapAdmin()).
 * The backend model is a status + tier + restrictions record; the UI "conditions" (speed governor, max daily hours, night driving,
 * probation target) map onto SecondChanceRecord columns / the `restrictions` JSON (see second-chance-rules.ts).
 */

export type ApiScStatus = "APPLIED" | "UNDER_REVIEW" | "RESUBMISSION_REQUESTED" | "APPROVED" | "REJECTED" | "SUSPENDED" | "REVOKED" | "EXPIRED";
export type ApiScTier = "TIER_1_PROBATION" | "TIER_2_RESTRICTED" | "TIER_3_GRADUATED";

export const SC_STATUSES: ApiScStatus[] = ["APPROVED", "APPLIED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED", "SUSPENDED", "REVOKED", "REJECTED", "EXPIRED"];
export const SC_TIERS: ApiScTier[] = ["TIER_1_PROBATION", "TIER_2_RESTRICTED", "TIER_3_GRADUATED"];

/** Strict schema on the backend (restrictionsSchema): unknown keys are rejected. */
export interface ScRestrictions {
  maxTripDistanceMeters?: number;
  maxDailyHours?: number;
  allowedHours?: { start: string; end: string; days?: number[] };
  allowedZoneIds?: string[];
  allowedVehicleIds?: string[];
  allowedServiceTypeCodes?: string[];
  restrictedNightDriving?: boolean;
  nightWindow?: { start: string; end: string };
}

export const DEFAULT_NIGHT_WINDOW = { start: "22:00", end: "05:00" } as const;

export interface ApiScCaptainBrief {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  cityId: string | null;
  city: string | null;
  status: ApiCaptainStatus;
  availability: ApiAvailability;
  rating: number;
  totalTrips: number;
}

export interface ApiScRecord {
  captainId: string;
  captain: ApiScCaptainBrief;
  status: ApiScStatus;
  isEnrolled: boolean;
  tier: ApiScTier;
  enrolledDate: string;
  appliedAt: string;
  sponsorMentor: string | null;
  eligibilityNotes: string | null;
  speedGovernorEnabled: boolean;
  maxDailyHours: number | null;
  restrictedNightDriving: boolean;
  restrictions: ScRestrictions;
  probationRidesTarget: number;
  probationRidesCompleted: number;
  incidentCount: number;
  complianceScore: number;
  lastAuditDate: string | null;
  nextReviewAt: string | null;
  reviewDue: boolean;
  expiresAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  revokedAt: string | null;
}

export interface ApiScChecklistItem {
  documentType: string;
  label: string;
  state: string;
  ok: boolean;
  documentId: string | null;
  rejectionReason: string | null;
}

export interface ApiScNote {
  id: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface ApiScDetail extends ApiScRecord {
  previousPlatforms: { name: string; deactivatedAt?: string; reasonCategory?: string }[];
  deactivationExplanation: string | null;
  decisionReason: string | null;
  requiredDocuments: ApiScChecklistItem[];
  recentNotes: ApiScNote[];
}

export interface ApiScStats {
  byStatus: Partial<Record<ApiScStatus, number>>;
  byTier: Partial<Record<ApiScTier, number>>;
  pendingApplications: number;
  dueReviews: number;
  expiringWithin30Days: number;
  averageComplianceScore: number | null;
  totalIncidents: number;
}

export function scStatusLabel(s: ApiScStatus): string {
  return s === "APPROVED" ? "Enrolled" : humanize(s);
}

export function scStatusVariant(s: ApiScStatus): BadgeVariant {
  switch (s) {
    case "APPROVED":
      return "teal";
    case "APPLIED":
    case "UNDER_REVIEW":
    case "RESUBMISSION_REQUESTED":
      return "warning";
    case "SUSPENDED":
      return "neutral";
    default:
      return "coral";
  }
}

export const scTierLabel = (t: ApiScTier): string => humanize(t.replace(/^TIER_(\d)_/, "Tier $1 "));

/** Which admin transitions the backend allows (SECOND_CHANCE_TRANSITIONS) -> actions to offer per status. */
export interface ScActions {
  startReview: boolean;
  approve: boolean;
  reject: boolean;
  requestResubmission: boolean;
  suspend: boolean;
  revoke: boolean;
  review: boolean;
  /** tier / restrictions can be edited in any status; the console offers it for every non-terminal record. */
  configure: boolean;
}

export function scActionsFor(status: ApiScStatus): ScActions {
  return {
    startReview: status === "APPLIED",
    approve: ["APPLIED", "UNDER_REVIEW", "SUSPENDED", "REVOKED", "EXPIRED"].includes(status),
    reject: ["APPLIED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED"].includes(status),
    requestResubmission: ["APPLIED", "UNDER_REVIEW"].includes(status),
    suspend: status === "APPROVED",
    revoke: status === "APPROVED" || status === "SUSPENDED",
    review: status === "APPROVED",
    configure: ["APPLIED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED", "APPROVED", "SUSPENDED"].includes(status),
  };
}

export function progressPercent(r: Pick<ApiScRecord, "probationRidesCompleted" | "probationRidesTarget">): number | null {
  if (r.probationRidesTarget <= 0) return null;
  return Math.min(100, Math.round((r.probationRidesCompleted / r.probationRidesTarget) * 100));
}

export function nightWindowOf(r: ScRestrictions): { start: string; end: string } {
  return r.nightWindow ?? DEFAULT_NIGHT_WINDOW;
}
