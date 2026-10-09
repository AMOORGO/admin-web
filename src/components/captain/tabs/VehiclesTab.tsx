"use client";

import React from "react";
import { Accessibility, Car, CheckCircle, Fuel, Palette, Users, XCircle, Zap } from "lucide-react";
import { Can } from "@/components/Can";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { type ApiCaptainDetail, checklistStateVariant, documentStatusLabel, documentStatusVariant } from "@/lib/adapters/captains";
import { humanize } from "@/lib/format";
import { type DialogState } from "../CaptainDialogs";
import { vehicleStatusVariant } from "../captainUi";

const btn = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition-colors";

export const VehiclesTab: React.FC<{ captain: ApiCaptainDetail; onAction: (d: DialogState) => void }> = ({ captain, onAction }) => {
  if (captain.vehicles.length === 0) {
    return (
      <Card>
        <EmptyState icon={Car} title="No vehicle registered" description="The captain has not added a vehicle yet." />
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {captain.vehicles.map((v) => {
        const vehicleDocs = captain.documentChecklist.filter((c) => c.vehicleId === v.id);
        const docs = captain.documents.filter((d) => d.vehicleId === v.id);
        return (
          <Card key={v.id} as="article" className="flex flex-col">
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight text-slate-900 dark:text-white">
                  {v.make} {v.model}
                </p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{v.year}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {v.isPrimary && <StatusPill variant="plum" dot={false}>Primary</StatusPill>}
                <StatusPill variant={vehicleStatusVariant(v.status)}>{humanize(v.status)}</StatusPill>
              </div>
            </div>

            <div className="px-4 sm:px-5">
              <div className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-800 bg-amber-50 px-4 py-2 font-mono text-xl font-extrabold tracking-[0.18em] text-slate-900 dark:border-slate-200 dark:bg-[#211226] dark:text-white">
                {v.plateNumber}
                {v.plateState && <span className="text-xs font-bold tracking-normal text-slate-600 dark:text-slate-300">{v.plateState}</span>}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm sm:p-5">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Colour</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{v.color}</dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Seats</dt>
                  <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{v.seats}</dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {v.isElectric ? <Zap className="h-4 w-4 shrink-0 text-[#14755F] dark:text-[#4FD2B2]" aria-hidden="true" /> : <Fuel className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Fuel</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{v.isElectric ? "Electric (EV)" : "Gas / Hybrid"}</dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Accessibility className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Wheelchair access</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{v.isWheelchairAccessible ? "Yes" : "No"}</dd>
                </div>
              </div>
            </dl>

            {(vehicleDocs.length > 0 || docs.length > 0) && (
              <div className="border-t border-[#F0E3ED] px-4 py-3 dark:border-[#331A3B] sm:px-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Vehicle documents</p>
                <ul className="space-y-1.5">
                  {vehicleDocs.map((c) => {
                    const doc = docs.find((d) => d.id === c.documentId);
                    return (
                      <li key={c.documentType} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-800 dark:text-slate-100">{c.label}</span>
                        {doc ? <StatusPill variant={documentStatusVariant(doc.status)}>{documentStatusLabel(doc.status)}</StatusPill> : <StatusPill variant={checklistStateVariant(c.state)}>{c.state === "MISSING" ? "Not uploaded" : humanize(c.state)}</StatusPill>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <Can permission="captains.edit">
              <div className="mt-auto flex flex-wrap gap-2 border-t border-[#F0E3ED] p-4 dark:border-[#331A3B] sm:px-5">
                {v.status !== "ACTIVE" && (
                  <button type="button" onClick={() => onAction({ kind: "vehicle", vehicle: v, status: "ACTIVE", makePrimary: false })} className={`${btn} border-[#B4F2E1] bg-[#EFFCF9] text-[#14755F] hover:bg-[#DCFAF2] dark:border-[#14755F] dark:bg-[#0D2620] dark:text-[#82E5CB]`}>
                    <CheckCircle className="h-4 w-4" aria-hidden="true" /> Activate
                  </button>
                )}
                {v.status !== "REJECTED" && (
                  <button type="button" onClick={() => onAction({ kind: "vehicle", vehicle: v, status: "REJECTED", makePrimary: false })} className={`${btn} border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200`}>
                    <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                  </button>
                )}
                {v.status === "ACTIVE" && !v.isPrimary && (
                  <button type="button" onClick={() => onAction({ kind: "vehicle", vehicle: v, status: "ACTIVE", makePrimary: true })} className={`${btn} border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-[#4B2757] dark:text-slate-100 dark:hover:bg-[#28162E]`}>
                    Make primary
                  </button>
                )}
              </div>
            </Can>
          </Card>
        );
      })}
    </div>
  );
};
