import type { SOSIncident } from "@/types";
import { formatDateTime, mpsToMph } from "@/lib/format";

export type ApiIncidentStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "FALSE_ALARM";
export type ApiIncidentType = "SOS" | "SAFETY_REPORT" | "ROUTE_DEVIATION" | "ACCIDENT" | "LOST_ITEM" | "HARASSMENT" | "OTHER";
export type ApiIncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ApiRealm = "RIDER" | "CAPTAIN" | "STAFF" | "SYSTEM";

/** Statuses a staff member can still act on. */
export const OPEN_STATUSES: ApiIncidentStatus[] = ["ACTIVE", "ACKNOWLEDGED"];
/** Fallback acknowledgement SLA (config `safety.sos_ack_sla_seconds` default) when an incident has no `ackDueAt`. */
export const DEFAULT_ACK_SLA_SECONDS = 60;

/** GET /admin/incidents item; also the payload base of the `sos.raised` / `incident.updated` socket events. */
export interface ApiIncidentSummary {
  id: string;
  ref: string;
  type: ApiIncidentType;
  severity: ApiIncidentSeverity;
  status: ApiIncidentStatus;
  rideId: string | null;
  cityId: string | null;
  triggeredBy: { realm: ApiRealm; id: string };
  lat: number | null;
  lng: number | null;
  assignedStaffId: string | null;
  acknowledgedAt: string | null;
  firstContactAt: string | null;
  ackDueAt: string | null;
  contactDueAt: string | null;
  slaBreached: boolean;
  resolvedAt: string | null;
  outcomeCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiIncidentEvent {
  id: string;
  kind: string;
  actorRealm: ApiRealm;
  actorId: string | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiLocationPoint {
  lat: number;
  lng: number;
  ts: number;
}

export interface ApiIncidentSnapshot {
  capturedAt: string;
  trigger: { lat: number | null; lng: number | null; batteryLevel: number | null };
  ride: {
    id: string;
    bookingRef: string;
    status: string;
    cityId: string;
    pickup: { lat: number; lng: number; address: string } | null;
    drop: { lat: number; lng: number; address: string } | null;
  } | null;
  rider: { id: string; name: string; ratingAvg: number; phone?: string } | null;
  captain: { id: string; name: string; ratingAvg: number; totalRides: number; phone?: string } | null;
  vehicle: { make?: string; model?: string; color?: string; plateNumber?: string; year?: number } | null;
  captainLastLocation: { lat: number; lng: number; speedMps: number | null; heading: number | null; ts: number } | null;
  recentLocations: ApiLocationPoint[];
}

export interface ApiIncidentContact {
  realm: ApiRealm;
  id: string;
  name: string;
  phone: string;
}

/** GET /admin/incidents/:id */
export interface ApiIncidentDetail extends ApiIncidentSummary {
  description: string | null;
  batteryLevel: number | null;
  speedMps: number | null;
  snapshot: ApiIncidentSnapshot | null;
  events: ApiIncidentEvent[];
  liveLocation: { lat: number; lng: number; heading: number | null; ts: string; etaSeconds: number; status: string } | null;
  contacts: {
    triggeredBy: ApiIncidentContact | null;
    counterparty: ApiIncidentContact | null;
    emergencyContacts: { name: string; phone: string; relation: string | null }[];
  };
}

/** `sos.raised` socket payload. */
export interface SosRaisedEvent extends ApiIncidentSummary {
  bookingRef: string | null;
  description: string | null;
  batteryLevel: number | null;
}

/** `incident.updated` socket payload (`change` is the timeline event kind). */
export interface IncidentUpdatedEvent extends ApiIncidentSummary {
  change: string;
  event?: ApiIncidentEvent;
}

/** Fields of POST /admin/incidents/:id/contact. */
export const CONTACT_PARTIES = [
  { value: "USER", label: "Triggering user" },
  { value: "COUNTERPARTY", label: "Other party of the ride" },
  { value: "EMERGENCY_CONTACT", label: "Emergency contact" },
  { value: "EMERGENCY_SERVICES", label: "Emergency services (police / medical)" },
  { value: "OTHER", label: "Other" },
] as const;
export type ContactParty = (typeof CONTACT_PARTIES)[number]["value"];

export const CONTACT_OUTCOMES = [
  { value: "REACHED", label: "Reached" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "REFUSED", label: "Refused" },
] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number]["value"];

export const CONTACT_METHODS = [
  { value: "CALL", label: "Call" },
  { value: "SMS", label: "SMS" },
  { value: "IN_APP", label: "In-app" },
] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number]["value"];

/** Resolution codes offered on "Close & Resolve" (free upper-case code on the backend; FALSE_ALARM closes it as a false alarm). */
export const RESOLVE_OUTCOMES = [
  { value: "SAFE_CONFIRMED", label: "Safe - confirmed with user" },
  { value: "POLICE_DISPATCHED", label: "Police dispatched" },
  { value: "MEDICAL_DISPATCHED", label: "Medical help dispatched" },
  { value: "RIDE_ENDED_SAFELY", label: "Ride ended safely" },
  { value: "UNABLE_TO_REACH", label: "Unable to reach user (closed)" },
  { value: "OTHER", label: "Other" },
] as const;

/** UI incident: the shell's `SOSIncident` plus what the API really provides. */
export interface IncidentView extends SOSIncident {
  ref: string;
  type: ApiIncidentType;
  severity: ApiIncidentSeverity;
  cityId: string | null;
  createdAt: string;
  ackDueAt: string | null;
  slaBreached: boolean;
  outcomeCode: string | null;
  assignedStaffId: string | null;
  /** The summary has no names/phones/battery/speed; those come with the detail (null until loaded). */
  battery: number | null;
  hasCoords: boolean;
  realm: ApiRealm;
  triggeredById: string;
  /** Whether an acknowledgement SLA applies (SOS-type incident still waiting for acknowledgement). */
  slaRunning: boolean;
}

export interface IncidentCtx {
  /** epoch ms used for the SLA countdown */
  now: number;
  cityName: (id: string | null | undefined) => string;
  /** staff id -> display name (null when unknown) */
  staffName?: (id: string) => string | null;
}

/** Seconds left on the acknowledgement SLA: from `ackDueAt`, else createdAt + the default SLA. 0 once acknowledged / closed. */
export function slaSecondsLeft(i: Pick<ApiIncidentSummary, "status" | "type" | "ackDueAt" | "createdAt">, now: number): number {
  if (i.status !== "ACTIVE" || i.type !== "SOS") return 0;
  const due = i.ackDueAt ? new Date(i.ackDueAt).getTime() : new Date(i.createdAt).getTime() + DEFAULT_ACK_SLA_SECONDS * 1000;
  return Math.max(0, Math.ceil((due - now) / 1000));
}

export function toIncident(i: ApiIncidentSummary, ctx: IncidentCtx, detail?: ApiIncidentDetail | null): IncidentView {
  const realm = i.triggeredBy.realm;
  const triggerer = detail?.contacts.triggeredBy ?? null;
  const snapName = realm === "CAPTAIN" ? detail?.snapshot?.captain?.name : detail?.snapshot?.rider?.name;
  const label = realm === "CAPTAIN" ? "Captain" : "Rider";
  const notes = (detail?.events ?? []).filter((e) => e.kind === "NOTE" && e.body).map((e) => e.body as string);
  const hasCoords = i.lat !== null && i.lng !== null;
  return {
    id: i.id,
    rideId: i.rideId ?? "",
    triggeredBy: realm === "CAPTAIN" ? "CAPTAIN" : "RIDER",
    userName: triggerer?.name ?? snapName ?? label,
    userPhone: triggerer?.phone ?? detail?.snapshot?.[realm === "CAPTAIN" ? "captain" : "rider"]?.phone ?? "",
    city: ctx.cityName(i.cityId),
    timestamp: formatDateTime(i.createdAt),
    slaSecondsLeft: slaSecondsLeft(i, ctx.now),
    status: i.status,
    coords: [i.lat ?? 0, i.lng ?? 0],
    batteryLevel: detail?.batteryLevel ?? 0,
    speedMph: detail?.speedMps != null ? Math.round(mpsToMph(detail.speedMps)) : undefined,
    audioRecordingAvailable: false,
    responderNotes: notes,
    assignedStaff: i.assignedStaffId ? (ctx.staffName?.(i.assignedStaffId) ?? undefined) : undefined,
    resolvedAt: i.resolvedAt ?? undefined,
    ref: i.ref,
    type: i.type,
    severity: i.severity,
    cityId: i.cityId,
    createdAt: i.createdAt,
    ackDueAt: i.ackDueAt,
    slaBreached: i.slaBreached,
    outcomeCode: i.outcomeCode,
    assignedStaffId: i.assignedStaffId,
    battery: detail?.batteryLevel ?? null,
    hasCoords,
    realm,
    triggeredById: i.triggeredBy.id,
    slaRunning: i.status === "ACTIVE" && i.type === "SOS",
  };
}

/** Most urgent first: earliest acknowledgement deadline (or creation time when none). */
export function compareUrgency(a: ApiIncidentSummary, b: ApiIncidentSummary): number {
  const key = (i: ApiIncidentSummary) => (i.ackDueAt ? new Date(i.ackDueAt).getTime() : new Date(i.createdAt).getTime() + DEFAULT_ACK_SLA_SECONDS * 1000);
  return key(a) - key(b);
}

export const isOpen = (i: Pick<ApiIncidentSummary, "status">): boolean => OPEN_STATUSES.includes(i.status);

/** Human label of a timeline event. */
export function eventTitle(e: ApiIncidentEvent): string {
  switch (e.kind) {
    case "CREATED":
      return "Incident raised";
    case "ALERT_SENT":
      return "Alerts sent";
    case "ACKNOWLEDGED":
      return "Acknowledged";
    case "ASSIGNED":
      return "Assigned";
    case "NOTE":
      return "Note";
    case "CONTACTED": {
      const m = e.meta ?? {};
      const party = typeof m.party === "string" ? m.party.toLowerCase().replace(/_/g, " ") : "party";
      const outcome = typeof m.outcome === "string" ? m.outcome.toLowerCase().replace(/_/g, " ") : "";
      return `Contacted ${party}${outcome ? ` (${outcome})` : ""}`;
    }
    case "ESCALATED":
      return "Escalated";
    case "RESOLVED": {
      const code = e.meta && typeof e.meta.outcomeCode === "string" ? e.meta.outcomeCode.toLowerCase().replace(/_/g, " ") : "";
      return code ? `Closed: ${code}` : "Closed";
    }
    case "CANCELLED":
      return "Cancelled by user";
    case "LOCATION":
      return "Location refreshed";
    case "SLA_BREACHED":
      return "SLA breached";
    default:
      return e.kind.toLowerCase().replace(/_/g, " ");
  }
}
