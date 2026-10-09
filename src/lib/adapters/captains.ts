import type { BadgeVariant } from "@/components/Badge";
import type { CaptainStatus } from "@/types";
import { avatarFor, formatDate, humanize } from "@/lib/format";

/**
 * Captains / KYC adapters. DTO shapes are typed from the real responses of
 * GET /admin/captains, GET /admin/captains/:id and GET /admin/documents (backend captain-admin.service.ts).
 */

export type ApiCaptainStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED" | "DEACTIVATED" | "DELETED";
export type ApiAvailability = "OFFLINE" | "ONLINE" | "BUSY" | "ON_RIDE" | "TEMP_UNAVAILABLE";
export type ApiDocumentStatus = "PENDING" | "VERIFIED" | "REJECTED" | "RESUBMISSION_REQUESTED" | "EXPIRED";
export type ApiVehicleStatus = "ACTIVE" | "INACTIVE" | "PENDING_REVIEW" | "REJECTED";
export type ApiChecklistState = "OK" | "MISSING" | "PENDING" | "REJECTED" | "RESUBMISSION_REQUESTED" | "EXPIRED";

export interface ApiVehicleLite {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  plateState?: string | null;
  isElectric: boolean;
  status?: ApiVehicleStatus;
}

export interface ApiCaptainListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  cityId: string | null;
  city: string | null;
  status: ApiCaptainStatus;
  availability: ApiAvailability;
  onRide: boolean;
  isSecondChance: boolean;
  flagged: boolean;
  /** 0..5 */
  rating: number;
  ratingCount: number;
  totalTrips: number;
  /** 0..1 */
  acceptanceRate: number;
  /** 0..1 */
  cancellationRate: number;
  serviceTypes: string[];
  vehicle: ApiVehicleLite | null;
  submittedAt: string | null;
  joinedAt: string;
}

export interface ApiStaffDocument {
  id: string;
  captainId: string;
  vehicleId: string | null;
  type: string;
  label: string;
  title: string;
  status: ApiDocumentStatus;
  /** masked, e.g. "••••1234" */
  documentNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  mimeType: string;
  sizeBytes: number;
  version: number;
  verifiedAt: string | null;
  verifiedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  uploadedAt: string;
  fileUrl: string | null;
  viewPath: string;
}

export interface ApiQueueDocument extends ApiStaffDocument {
  captain: {
    id: string;
    name: string;
    phone: string;
    cityId: string | null;
    city: string | null;
    status: ApiCaptainStatus;
    isSecondChance: boolean;
  };
}

export interface ApiVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  plateState: string | null;
  isElectric: boolean;
  seats: number;
  isWheelchairAccessible: boolean;
  status: ApiVehicleStatus;
  isPrimary: boolean;
}

export interface ApiChecklistItem {
  documentType: string;
  label: string;
  vehicleId: string | null;
  state: ApiChecklistState;
  ok: boolean;
  requiresExpiry: boolean;
  documentId: string | null;
  expiresAt: string | null;
  daysToExpiry: number | null;
  rejectionReason: string | null;
}

export interface ApiCaptainDetail {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  avatar: string | null;
  dateOfBirth: string | null;
  address: { addressLine: string | null; city: string | null; state: string | null; postalCode: string | null };
  cityId: string | null;
  city: string | null;
  status: ApiCaptainStatus;
  statusReason: string | null;
  availability: ApiAvailability;
  onRide: boolean;
  activeRideId: string | null;
  isSecondChance: boolean;
  secondChance: { status: string; tier: string; expiresAt: string | null; nextReviewAt: string | null } | null;
  flagged: boolean;
  payoutsEnabled: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  reapplyAfter: string | null;
  suspendedUntil: string | null;
  joinedAt: string;
  lastOnlineAt: string | null;
  metrics: {
    rating: number;
    ratingCount: number;
    totalTrips: number;
    acceptanceRate: number;
    cancellationRate: number;
    offersReceived: number;
    offersAccepted: number;
    offersDeclined: number;
    offersMissed: number;
    ridesCancelled: number;
  };
  vehicle: ApiVehicleLite | null;
  vehicles: ApiVehicle[];
  serviceTypes: { code: string; name: string; vehicleId: string | null; enabled: boolean }[];
  documents: ApiStaffDocument[];
  documentChecklist: ApiChecklistItem[];
  eligibility: { eligible: boolean; reasons: string[] };
  statusHistory: { id: string; from: string | null; to: string; reason: string | null; at: string }[];
}

export interface ApiSignedUrl {
  url: string;
  expiresInSeconds: number;
  mimeType: string;
  /** Full decrypted document number (only via this audited call). */
  documentNumber: string | null;
}

/** UI status: the mock's five values plus the backend lifecycle states the mock never modelled. */
export type CaptainDisplayStatus = CaptainStatus | "SUBMITTED" | "UNDER_REVIEW" | "REJECTED" | "DRAFT" | "DEACTIVATED" | "DELETED";

/** Backend approval status + availability -> console status. */
export function toCaptainStatus(status: ApiCaptainStatus, availability: ApiAvailability, onRide: boolean): CaptainDisplayStatus {
  switch (status) {
    case "APPROVED":
      if (onRide || availability === "ON_RIDE") return "ON_TRIP";
      if (availability === "ONLINE" || availability === "BUSY") return "ACTIVE";
      return "OFFLINE";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return status;
    default:
      return status;
  }
}

export function captainStatusLabel(s: CaptainDisplayStatus): string {
  if (s === "PENDING_REVIEW") return "Pending review";
  return humanize(s);
}

export function captainStatusVariant(s: CaptainDisplayStatus): BadgeVariant {
  switch (s) {
    case "ACTIVE":
      return "teal";
    case "ON_TRIP":
      return "plum";
    case "OFFLINE":
    case "DRAFT":
    case "DELETED":
      return "neutral";
    case "PENDING_REVIEW":
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "warning";
    default:
      return "coral";
  }
}

export interface CaptainRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  cityId: string | null;
  /** Address city stored on the captain; the console prefers the operating-city name resolved from cityId. */
  cityText: string | null;
  status: CaptainDisplayStatus;
  rawStatus: ApiCaptainStatus;
  availability: ApiAvailability;
  isSecondChance: boolean;
  flagged: boolean;
  rating: number;
  ratingCount: number;
  totalTrips: number;
  /** percent 0..100 */
  acceptanceRate: number;
  /** percent 0..100 */
  cancellationRate: number;
  serviceTypes: string[];
  vehicle: ApiVehicleLite | null;
  joinedAt: string;
  submittedAt: string | null;
}

const pct = (ratio: number): number => Math.round(ratio * 1000) / 10;

export function toCaptainRow(c: ApiCaptainListItem): CaptainRow {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? "",
    avatar: avatarFor(c.name, c.avatar),
    cityId: c.cityId,
    cityText: c.city,
    status: toCaptainStatus(c.status, c.availability, c.onRide),
    rawStatus: c.status,
    availability: c.availability,
    isSecondChance: c.isSecondChance,
    flagged: c.flagged,
    rating: c.rating,
    ratingCount: c.ratingCount,
    totalTrips: c.totalTrips,
    acceptanceRate: pct(c.acceptanceRate),
    cancellationRate: pct(c.cancellationRate),
    serviceTypes: c.serviceTypes,
    vehicle: c.vehicle,
    joinedAt: c.joinedAt,
    submittedAt: c.submittedAt,
  };
}

/** Document status presentation (the mock knew four statuses; EXPIRED comes from the backend sweep). */
export function documentStatusVariant(s: ApiDocumentStatus): BadgeVariant {
  switch (s) {
    case "VERIFIED":
      return "teal";
    case "RESUBMISSION_REQUESTED":
      return "warning";
    case "REJECTED":
    case "EXPIRED":
      return "coral";
    default:
      return "neutral";
  }
}

export function checklistStateVariant(s: ApiChecklistState): BadgeVariant {
  switch (s) {
    case "OK":
      return "teal";
    case "PENDING":
      return "neutral";
    case "RESUBMISSION_REQUESTED":
      return "warning";
    default:
      return "coral";
  }
}

export const documentStatusLabel = (s: ApiDocumentStatus): string => (s === "PENDING" ? "Pending review" : humanize(s));

export const displayDate = (iso: string | null | undefined): string => (iso ? formatDate(iso) : "—");

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export type DocumentPreviewKind = "image" | "pdf" | "other";
export function previewKind(mime: string): DocumentPreviewKind {
  if (mime === "image/heic") return "other"; // browsers cannot render HEIC
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

/** Operator-facing city label: operating-city name when known, else the free-text city on the profile, else a dash. */
export function cityLabel(cityId: string | null, cityText: string | null, cities: ReadonlyArray<{ id: string; name: string }>): string {
  const known = cityId ? cities.find((c) => c.id === cityId)?.name : undefined;
  return known ?? cityText ?? "—";
}
