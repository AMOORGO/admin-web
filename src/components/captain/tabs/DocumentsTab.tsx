"use client";

import React, { useState } from "react";
import { CheckCircle, Eye, FileX2, RotateCcw, XCircle } from "lucide-react";
import { Can } from "@/components/Can";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { type ApiCaptainDetail, checklistStateVariant, displayDate, documentStatusLabel, documentStatusVariant } from "@/lib/adapters/captains";
import { humanize } from "@/lib/format";
import { useClock } from "@/lib/hooks/useClock";
import { type DialogState } from "../CaptainDialogs";
import { type DocRow, ExpiryChip, buildDocRows } from "../captainUi";

interface DocumentsTabProps {
  captain: ApiCaptainDetail;
  onView: (docId: string) => void;
  onAction: (d: DialogState) => void;
  canView: boolean;
}

const btn = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-bold transition-colors";

function RowStatus({ row }: { row: DocRow }) {
  if (row.doc) return <StatusPill variant={documentStatusVariant(row.doc.status)}>{documentStatusLabel(row.doc.status)}</StatusPill>;
  return <StatusPill variant={row.checklist ? checklistStateVariant(row.checklist.state) : "neutral"}>{row.checklist ? (row.checklist.state === "MISSING" ? "Not uploaded" : humanize(row.checklist.state)) : "—"}</StatusPill>;
}

function RowActions({ row, onView, onAction, canView }: { row: DocRow } & Pick<DocumentsTabProps, "onView" | "onAction" | "canView">) {
  const d = row.doc;
  if (!d) return <span className="text-sm text-slate-500 dark:text-slate-400">Waiting for upload</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canView && (
        <button type="button" onClick={() => onView(d.id)} className={`${btn} border-[#7A2B66] bg-[#FAF0F7] text-[#521A44] hover:bg-[#F5E2F0] dark:border-[#A74490] dark:bg-[#331A3B] dark:text-[#F5E2F0] dark:hover:bg-[#4B2757]`}>
          <Eye className="h-4 w-4" aria-hidden="true" /> View
        </button>
      )}
      {!row.superseded && (
        <Can permission="captains.review_docs">
          {d.status === "PENDING" && (
            <button type="button" onClick={() => onAction({ kind: "doc-approve", doc: d })} className={`${btn} border-[#B4F2E1] bg-[#EFFCF9] text-[#14755F] hover:bg-[#DCFAF2] dark:border-[#14755F] dark:bg-[#0D2620] dark:text-[#82E5CB]`}>
              <CheckCircle className="h-4 w-4" aria-hidden="true" /> Approve
            </button>
          )}
          {(d.status === "PENDING" || d.status === "VERIFIED") && (
            <>
              <button type="button" onClick={() => onAction({ kind: "doc-reject", doc: d })} className={`${btn} border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200`}>
                <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
              </button>
              <button type="button" onClick={() => onAction({ kind: "doc-resubmit", doc: d })} className={`${btn} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200`}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Re-upload
              </button>
            </>
          )}
        </Can>
      )}
    </div>
  );
}

function ReviewerNote({ row }: { row: DocRow }) {
  const d = row.doc;
  if (!d) return <span className="text-slate-500 dark:text-slate-400">—</span>;
  if (d.rejectionReason) return <span className="text-amber-900 dark:text-amber-200">{d.rejectionReason}</span>;
  if (d.verifiedBy) return <span className="text-slate-700 dark:text-slate-200">Verified by {d.verifiedBy}{d.verifiedAt ? ` on ${displayDate(d.verifiedAt)}` : ""}</span>;
  if (d.status === "PENDING") return <span className="text-slate-600 dark:text-slate-300">Waiting for review</span>;
  return <span className="text-slate-500 dark:text-slate-400">—</span>;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ captain, onView, onAction, canView }) => {
  const now = useClock();
  const [showOld, setShowOld] = useState(false);
  const { rows, older } = buildDocRows(captain);
  const required = captain.documentChecklist;
  const verified = required.filter((c) => c.ok).length;
  const pending = captain.documents.filter((d) => d.status === "PENDING").length;
  const pct = required.length > 0 ? Math.round((verified / required.length) * 100) : 0;
  const shown = showOld ? [...rows, ...older] : rows;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {verified} of {required.length} required documents verified
              </h2>
              <StatusPill variant={captain.eligibility.eligible ? "teal" : "warning"}>{captain.eligibility.eligible ? "Eligible to drive" : "Not eligible yet"}</StatusPill>
              {pending > 0 && <StatusPill variant="plum">{pending} awaiting review</StatusPill>}
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#211226]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Required documents verified">
              <div className="h-full rounded-full bg-[#189578] transition-all dark:bg-[#4FD2B2]" style={{ width: `${pct}%` }} />
            </div>
            {!captain.eligibility.eligible && captain.eligibility.reasons.length > 0 && <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-300">Blocking: {captain.eligibility.reasons.join(" • ")}</p>}
          </div>
          {!canView && <p className="max-w-xs text-[13px] text-slate-600 dark:text-slate-300">Opening the files needs the captains.review_docs permission.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Verification documents" description="Every required document, its latest upload and review status." />
        {shown.length === 0 ? (
          <EmptyState icon={FileX2} title="No documents on file" description="The captain has not uploaded anything yet." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="data-table-container hidden border-t border-[#F0E3ED] dark:border-[#331A3B] lg:block">
              <table className="w-full min-w-[60rem] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="px-5 py-3">Document</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Doc no.</th>
                    <th className="px-3 py-3">Uploaded</th>
                    <th className="px-3 py-3">Expires</th>
                    <th className="px-3 py-3">Reviewer note</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E3ED] dark:divide-[#331A3B]">
                  {shown.map((row) => (
                    <tr key={row.key} className={row.superseded ? "opacity-70" : ""}>
                      <td className="px-5 py-3">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white">
                          {row.label}
                          {row.doc && <span className="ml-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">v{row.doc.version}</span>}
                          {row.superseded && <span className="ml-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">(older)</span>}
                        </span>
                        {row.vehicleLabel && <span className="block font-mono text-xs text-slate-600 dark:text-slate-300">{row.vehicleLabel}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <RowStatus row={row} />
                      </td>
                      <td className="px-3 py-3 font-mono text-[13px] text-slate-800 dark:text-slate-100">{row.doc?.documentNumber ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-800 dark:text-slate-100">{row.doc ? displayDate(row.doc.uploadedAt) : "—"}</td>
                      <td className="px-3 py-3">{row.doc ? <ExpiryChip expiryDate={row.doc.expiryDate} now={now} required={row.checklist?.requiresExpiry ?? false} /> : "—"}</td>
                      <td className="wrap max-w-[16rem] px-3 py-3 text-[13px]">
                        <ReviewerNote row={row} />
                      </td>
                      <td className="px-5 py-3">
                        <RowActions row={row} onView={onView} onAction={onAction} canView={canView} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tablet / phone cards */}
            <ul className="divide-y divide-[#F0E3ED] border-t border-[#F0E3ED] dark:divide-[#331A3B] dark:border-[#331A3B] lg:hidden">
              {shown.map((row) => (
                <li key={row.key} className={`space-y-3 p-4 ${row.superseded ? "opacity-70" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {row.label}
                        {row.doc && <span className="ml-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">v{row.doc.version}</span>}
                      </p>
                      {row.vehicleLabel && <p className="font-mono text-xs text-slate-600 dark:text-slate-300">{row.vehicleLabel}</p>}
                    </div>
                    <RowStatus row={row} />
                  </div>
                  {row.doc && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Doc no.</dt>
                        <dd className="font-mono text-slate-900 dark:text-white">{row.doc.documentNumber ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Uploaded</dt>
                        <dd className="tabular-nums text-slate-900 dark:text-white">{displayDate(row.doc.uploadedAt)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Expires</dt>
                        <dd>
                          <ExpiryChip expiryDate={row.doc.expiryDate} now={now} required={row.checklist?.requiresExpiry ?? false} />
                        </dd>
                      </div>
                      <div className="col-span-2 text-[13px]">
                        <ReviewerNote row={row} />
                      </div>
                    </dl>
                  )}
                  <RowActions row={row} onView={onView} onAction={onAction} canView={canView} />
                </li>
              ))}
            </ul>
          </>
        )}
        {older.length > 0 && (
          <div className="border-t border-[#F0E3ED] px-4 py-3 dark:border-[#331A3B] sm:px-5">
            <button type="button" onClick={() => setShowOld((v) => !v)} className="min-h-10 text-sm font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC]">
              {showOld ? "Hide" : "Show"} older versions ({older.length})
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};
