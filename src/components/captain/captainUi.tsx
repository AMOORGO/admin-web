"use client";

import React from "react";
import { Star } from "lucide-react";
import type { BadgeVariant } from "@/components/Badge";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  type ApiAvailability,
  type ApiCaptainDetail,
  type ApiChecklistItem,
  type ApiStaffDocument,
  type ApiVehicle,
  displayDate,
} from "@/lib/adapters/captains";
import { daysUntil, formatNumber } from "@/lib/format";

export type CaptainTab = "overview" | "documents" | "vehicles" | "trips" | "earnings" | "activity";

export const availabilityLabel = (a: ApiAvailability, onRide: boolean): string => {
  if (onRide || a === "ON_RIDE") return "On trip";
  switch (a) {
    case "ONLINE":
      return "Online";
    case "BUSY":
      return "Busy";
    case "TEMP_UNAVAILABLE":
      return "Unavailable";
    default:
      return "Offline";
  }
};

export const availabilityVariant = (a: ApiAvailability, onRide: boolean): BadgeVariant => {
  if (onRide || a === "ON_RIDE" || a === "BUSY") return "plum";
  if (a === "ONLINE") return "teal";
  if (a === "TEMP_UNAVAILABLE") return "warning";
  return "neutral";
};

export const vehicleStatusVariant = (s: ApiVehicle["status"]): BadgeVariant => (s === "ACTIVE" ? "teal" : s === "PENDING_REVIEW" ? "warning" : s === "INACTIVE" ? "neutral" : "coral");

/** ★ 4.82 (1,240) with five small stars; "New" when the captain has no ratings. */
export const RatingStars: React.FC<{ rating: number; count: number; className?: string }> = ({ rating, count, className = "" }) => {
  if (count <= 0) return <span className={`text-sm font-semibold text-slate-600 dark:text-slate-300 ${className}`}>No ratings yet</span>;
  const full = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={`${rating.toFixed(2)} out of 5 from ${formatNumber(count)} ratings`}>
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`h-4 w-4 ${i <= full ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
        ))}
      </span>
      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rating.toFixed(2)}</span>
      <span className="text-sm text-slate-600 dark:text-slate-300">({formatNumber(count)})</span>
      <span className="sr-only">out of 5 stars</span>
    </span>
  );
};

/** "Expires in 9 days" coloured by urgency (red <= 14 days or past, amber <= 30, neutral otherwise). */
export const ExpiryChip: React.FC<{ expiryDate: string | null; now: number; required?: boolean }> = ({ expiryDate, now, required = true }) => {
  if (!expiryDate) return <span className="text-sm text-slate-500 dark:text-slate-400">{required ? "—" : "No expiry"}</span>;
  const d = daysUntil(expiryDate, now);
  if (d === null) return <span>{displayDate(expiryDate)}</span>;
  let variant: BadgeVariant = "neutral";
  let text = `in ${d} days`;
  if (d < 0) {
    variant = "danger";
    text = `Expired ${Math.abs(d)} ${Math.abs(d) === 1 ? "day" : "days"} ago`;
  } else if (d === 0) {
    variant = "danger";
    text = "Expires today";
  } else if (d <= 14) {
    variant = "danger";
    text = `Expires in ${d} ${d === 1 ? "day" : "days"}`;
  } else if (d <= 30) {
    variant = "warning";
    text = `Expires in ${d} days`;
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="text-sm tabular-nums text-slate-800 dark:text-slate-100">{displayDate(expiryDate)}</span>
      <StatusPill variant={variant} dot={false}>
        {text}
      </StatusPill>
    </span>
  );
};

/** One line of the Documents tab: a required document type (with its latest upload, if any) or an extra upload. */
export interface DocRow {
  key: string;
  label: string;
  vehicleLabel: string | null;
  doc: ApiStaffDocument | null;
  checklist: ApiChecklistItem | null;
  /** Older versions of the same document type. */
  superseded: boolean;
}

/** Latest-version document per (type, vehicle); the API returns type asc, version desc. */
export function splitDocuments(docs: ApiStaffDocument[]): { current: ApiStaffDocument[]; older: ApiStaffDocument[] } {
  const seen = new Set<string>();
  const current: ApiStaffDocument[] = [];
  const older: ApiStaffDocument[] = [];
  for (const d of docs) {
    const k = `${d.type}:${d.vehicleId ?? ""}`;
    if (seen.has(k)) older.push(d);
    else {
      seen.add(k);
      current.push(d);
    }
  }
  return { current, older };
}

/** Checklist rows first (everything the captain must have), then uploads that are not on the checklist, then old versions. */
export function buildDocRows(captain: ApiCaptainDetail): { rows: DocRow[]; older: DocRow[] } {
  const { current, older } = splitDocuments(captain.documents);
  const plate = (vehicleId: string | null) => {
    const v = vehicleId ? captain.vehicles.find((x) => x.id === vehicleId) : undefined;
    return v ? v.plateNumber : null;
  };
  const used = new Set<string>();
  const rows: DocRow[] = captain.documentChecklist.map((c) => {
    const doc = c.documentId ? (current.find((d) => d.id === c.documentId) ?? captain.documents.find((d) => d.id === c.documentId) ?? null) : null;
    if (doc) used.add(doc.id);
    return { key: `${c.documentType}:${c.vehicleId ?? ""}`, label: c.label, vehicleLabel: plate(c.vehicleId), doc, checklist: c, superseded: false };
  });
  for (const d of current) {
    if (used.has(d.id)) continue;
    rows.push({ key: d.id, label: d.label, vehicleLabel: plate(d.vehicleId), doc: d, checklist: null, superseded: false });
  }
  const olderRows: DocRow[] = older.map((d) => ({ key: d.id, label: d.label, vehicleLabel: plate(d.vehicleId), doc: d, checklist: null, superseded: true }));
  return { rows, older: olderRows };
}
