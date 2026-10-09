/** Captain document checklist + eligibility, mirroring the backend's evaluate-eligibility / document-checklist rules. */
import type { ApiCaptainDetail, ApiChecklistItem, ApiChecklistState, ApiStaffDocument } from "../../adapters/captains";
import { DAY } from "../util";

export interface DocMeta {
  label: string;
  vehicle: boolean;
  expiry: boolean;
  /** Required for every captain. */
  required: boolean;
  /** Extra requirement for Second Chance captains. */
  secondChance: boolean;
}

export const DOC_META: Record<string, DocMeta> = {
  GOVERNMENT_ID: { label: "Government ID", vehicle: false, expiry: false, required: true, secondChance: false },
  DRIVERS_LICENSE: { label: "Driver's license", vehicle: false, expiry: true, required: true, secondChance: false },
  VEHICLE_REGISTRATION: { label: "Vehicle registration", vehicle: true, expiry: true, required: true, secondChance: false },
  VEHICLE_INSURANCE: { label: "Vehicle insurance", vehicle: true, expiry: true, required: true, secondChance: false },
  BACKGROUND_CHECK: { label: "Background check", vehicle: false, expiry: false, required: true, secondChance: false },
  PROFILE_PHOTO: { label: "Profile photo", vehicle: false, expiry: false, required: true, secondChance: false },
  DRIVING_RECORD: { label: "Driving record (MVR)", vehicle: false, expiry: false, required: false, secondChance: true },
  DEACTIVATION_EXPLANATION: { label: "Explanation of deactivation", vehicle: false, expiry: false, required: false, secondChance: true },
};

export const labelFor = (type: string): string => DOC_META[type]?.label ?? type;

function todayUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const expiryMs = (doc: ApiStaffDocument): number | null => (doc.expiryDate ? new Date(doc.expiryDate).getTime() : null);

/** Latest-version document per (type, vehicle). */
export function currentDocuments(docs: readonly ApiStaffDocument[]): ApiStaffDocument[] {
  const best = new Map<string, ApiStaffDocument>();
  for (const d of docs) {
    const k = `${d.type}:${d.vehicleId ?? ""}`;
    const cur = best.get(k);
    if (!cur || d.version > cur.version) best.set(k, d);
  }
  return [...best.values()];
}

export function buildChecklist(d: ApiCaptainDetail, now: number): ApiChecklistItem[] {
  const primary = d.vehicles.find((v) => v.isPrimary) ?? d.vehicles[0];
  const current = currentDocuments(d.documents);
  const items: ApiChecklistItem[] = [];
  for (const [type, meta] of Object.entries(DOC_META)) {
    if (!meta.required && !(meta.secondChance && d.isSecondChance)) continue;
    const vehicleId = meta.vehicle ? (primary?.id ?? null) : null;
    const doc = current.find((x) => x.type === type && (x.vehicleId ?? null) === vehicleId);
    let state: ApiChecklistState = "MISSING";
    let daysToExpiry: number | null = null;
    const exp = doc ? expiryMs(doc) : null;
    if (exp !== null) daysToExpiry = Math.round((exp - todayUtc(now)) / DAY);
    if (doc) {
      switch (doc.status) {
        case "VERIFIED":
          state = exp !== null && exp < todayUtc(now) ? "EXPIRED" : "OK";
          break;
        case "PENDING":
          state = "PENDING";
          break;
        case "REJECTED":
          state = "REJECTED";
          break;
        case "RESUBMISSION_REQUESTED":
          state = "RESUBMISSION_REQUESTED";
          break;
        case "EXPIRED":
          state = "EXPIRED";
          break;
      }
    }
    items.push({
      documentType: type,
      label: meta.label,
      vehicleId,
      state,
      ok: state === "OK",
      requiresExpiry: meta.expiry,
      documentId: doc?.id ?? null,
      expiresAt: doc?.expiryDate ?? null,
      daysToExpiry,
      rejectionReason: doc?.rejectionReason ?? null,
    });
  }
  return items;
}

/** Recomputes the derived checklist / eligibility / expiry-state of a captain after any document change. */
export function refreshDerived(d: ApiCaptainDetail, now: number): void {
  // Verified documents whose expiry date has passed are flagged by the (simulated) nightly sweep.
  for (const doc of d.documents) {
    const exp = expiryMs(doc);
    if (doc.status === "VERIFIED" && exp !== null && exp < todayUtc(now)) doc.status = "EXPIRED";
  }
  d.documentChecklist = buildChecklist(d, now);
  const reasons: string[] = [];
  for (const item of d.documentChecklist) {
    if (!item.ok) reasons.push(`${item.label}: ${item.state.toLowerCase().replace(/_/g, " ")}`);
  }
  if (d.vehicles.length === 0) reasons.push("No vehicle on file");
  d.eligibility = { eligible: reasons.length === 0, reasons };
}

export function maskNumber(full: string): string {
  return `••••${full.slice(-4)}`;
}
