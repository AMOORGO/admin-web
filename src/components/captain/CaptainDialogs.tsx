"use client";

import React, { useCallback, useState } from "react";
import { Badge } from "@/components/Badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { type ApiCaptainDetail, type ApiStaffDocument, type ApiVehicle, type ApiVehicleStatus, documentStatusLabel, documentStatusVariant } from "@/lib/adapters/captains";
import { useAuth } from "@/lib/auth/AuthProvider";
import { humanize } from "@/lib/format";
import { invalidate } from "@/lib/invalidate";
import { splitDocuments } from "./captainUi";

export type DialogState =
  | { kind: "doc-approve"; doc: ApiStaffDocument }
  | { kind: "doc-reject"; doc: ApiStaffDocument }
  | { kind: "doc-resubmit"; doc: ApiStaffDocument }
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "resubmit" }
  | { kind: "suspend" }
  | { kind: "reactivate" }
  | { kind: "vehicle"; vehicle: ApiVehicle; status: ApiVehicleStatus; makePrimary: boolean };

const inputCls = "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900 dark:border-[#331A3B] dark:bg-[#211226] dark:text-white";

/**
 * Every captain decision (application, document, vehicle, suspension) with its reason / extra fields. The same
 * endpoints, permissions and validation the old KYC dialog used; the caller decides which buttons to show.
 */
export function useCaptainDialogs(captain: ApiCaptainDetail | undefined, captainId: string, onDone: () => void): { openDialog: (d: DialogState) => void; dialogs: React.ReactNode } {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = !!user?.roles.includes("SUPER_ADMIN");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [approveExpiry, setApproveExpiry] = useState("");
  const [approveNumber, setApproveNumber] = useState("");
  const [overrideDocs, setOverrideDocs] = useState(false);
  const [reapplyDays, setReapplyDays] = useState("");
  const [resubmitIds, setResubmitIds] = useState<string[]>([]);
  const [until, setUntil] = useState("");

  const openDialog = useCallback((d: DialogState) => {
    setApproveExpiry(d.kind === "doc-approve" ? (d.doc.expiryDate ?? "") : "");
    setApproveNumber("");
    setOverrideDocs(false);
    setReapplyDays("");
    setUntil("");
    setResubmitIds(d.kind === "doc-resubmit" ? [d.doc.id] : []);
    setDialog(d);
  }, []);

  const afterMutation = (message: string) => {
    toast.success(message);
    invalidate("captains", "kyc");
    setDialog(null);
    onDone();
  };

  /** Runs the request for the open dialog; throws (shown inside the dialog) on backend errors. */
  const submit = async (reason: string): Promise<boolean> => {
    if (!captain || !dialog) return false;
    switch (dialog.kind) {
      case "doc-approve":
        await api.patch(`/admin/captains/${captainId}/documents/${dialog.doc.id}`, {
          action: "APPROVE",
          ...(approveExpiry ? { expiresAt: approveExpiry } : {}),
          ...(approveNumber.trim() ? { documentNumber: approveNumber.trim() } : {}),
        });
        afterMutation(`${dialog.doc.label} approved`);
        return true;
      case "doc-reject":
        await api.patch(`/admin/captains/${captainId}/documents/${dialog.doc.id}`, { action: "REJECT", reason });
        afterMutation(`${dialog.doc.label} rejected`);
        return true;
      case "doc-resubmit":
        await api.patch(`/admin/captains/${captainId}/documents/${dialog.doc.id}`, { action: "REQUEST_RESUBMISSION", reason });
        afterMutation(`Re-upload requested for ${dialog.doc.label}`);
        return true;
      case "approve":
        await api.post(`/admin/captains/${captainId}/approve`, { reason, ...(overrideDocs ? { overrideDocuments: true } : {}) });
        afterMutation(`${captain.name} approved`);
        return true;
      case "reject": {
        const days = reapplyDays.trim() === "" ? undefined : Number(reapplyDays);
        if (days !== undefined && (!Number.isInteger(days) || days < 0 || days > 365)) throw new Error("Reapply wait must be a whole number of days between 0 and 365");
        await api.post(`/admin/captains/${captainId}/reject`, { reason, ...(days !== undefined ? { reapplyAfterDays: days } : {}) });
        afterMutation(`${captain.name}'s application rejected`);
        return true;
      }
      case "resubmit":
        await api.post(`/admin/captains/${captainId}/request-resubmission`, { reason, ...(resubmitIds.length ? { documentIds: resubmitIds } : {}) });
        afterMutation("Resubmission requested from the captain");
        return true;
      case "suspend": {
        const untilIso = until ? new Date(until).toISOString() : undefined;
        if (untilIso && new Date(untilIso).getTime() <= Date.now()) throw new Error("The suspension end must be in the future");
        await api.post(`/admin/captains/${captainId}/suspend`, { reason, ...(untilIso ? { until: untilIso } : {}) });
        afterMutation(`${captain.name} suspended`);
        return true;
      }
      case "reactivate":
        await api.post(`/admin/captains/${captainId}/reactivate`, { reason });
        afterMutation(`${captain.name} reactivated`);
        return true;
      case "vehicle":
        await api.patch(`/admin/captains/${captainId}/vehicles/${dialog.vehicle.id}`, { reason, status: dialog.status, ...(dialog.makePrimary ? { isPrimary: true } : {}) });
        afterMutation(`Vehicle ${dialog.vehicle.plateNumber} updated`);
        return true;
    }
  };

  const config = (() => {
    if (!captain || !dialog) return null;
    switch (dialog.kind) {
      case "doc-approve":
        return { title: `Approve ${dialog.doc.label}`, description: "Confirm the document is legible, genuine and matches the captain. The expiry date must be the one printed on the document.", confirmText: "Approve Document", destructive: false, requireReason: false, minReason: 3, placeholder: "", disabled: false };
      case "doc-reject":
        return { title: `Reject ${dialog.doc.label}`, description: "The document is marked REJECTED and the captain is notified with the reason below.", confirmText: "Reject Document", destructive: true, requireReason: true, minReason: 3, placeholder: "e.g. Document belongs to a different person, fraudulent credentials...", disabled: false };
      case "doc-resubmit":
        return { title: `Request re-upload of ${dialog.doc.label}`, description: "The captain is asked to upload a replacement; the reason is shown in the driver app.", confirmText: "Send Request to Driver App", destructive: false, requireReason: true, minReason: 3, placeholder: "e.g. Image is blurry and edges are cut off. Please upload a flat scan...", disabled: false };
      case "approve":
        return {
          title: "Approve Captain Application",
          description: `This will activate ${captain.name} on the AMOORGO Captain platform, enabling them to receive dispatch offers.`,
          confirmText: "Confirm Approval",
          destructive: false,
          requireReason: true,
          minReason: overrideDocs ? 10 : 3,
          placeholder: overrideDocs ? "Override justification (10+ characters)..." : "Approval notes (e.g. All documents verified)...",
          disabled: false,
        };
      case "reject":
        return { title: "Reject Captain Application", description: `This will deny ${captain.name}'s application and notify them with the justification below.`, confirmText: "Reject Application", destructive: true, requireReason: true, minReason: 3, placeholder: "e.g. Disqualified driving record, fraudulent credentials...", disabled: false };
      case "resubmit":
        return {
          title: "Request Resubmission",
          description:
            captain.status === "APPROVED"
              ? "Select the documents the captain must re-upload. They stay approved but lose driving eligibility until replacements are verified."
              : "The application returns to DRAFT so the captain can fix it. Optionally flag the documents that need replacing.",
          confirmText: "Send Request to Driver App",
          destructive: false,
          requireReason: true,
          minReason: 3,
          placeholder: "Tell the captain what to fix...",
          disabled: captain.status === "APPROVED" && resubmitIds.length === 0,
        };
      case "suspend":
        return {
          title: "Suspend Captain Credentials",
          description: `Suspending ${captain.name} takes them offline immediately and blocks new dispatch. A ride already in progress is not interrupted.`,
          confirmText: "Confirm Suspension",
          destructive: true,
          requireReason: true,
          minReason: 3,
          placeholder: "Specify reason (e.g. Speed telemetry violation, customer complaint investigation, document lapse)...",
          disabled: false,
        };
      case "reactivate":
        return { title: "Reactivate Captain Account", description: `Reactivating ${captain.name} will restore dispatch availability.`, confirmText: "Confirm Reactivation", destructive: false, requireReason: true, minReason: 3, placeholder: "Why is the suspension being lifted?", disabled: false };
      case "vehicle":
        return {
          title: dialog.makePrimary ? "Make Vehicle Primary" : `Set Vehicle ${humanize(dialog.status)}`,
          description: `${dialog.vehicle.make} ${dialog.vehicle.model} (${dialog.vehicle.plateNumber})`,
          confirmText: "Confirm",
          destructive: dialog.status === "REJECTED",
          requireReason: true,
          minReason: 3,
          placeholder: "Reason for the vehicle review decision...",
          disabled: false,
        };
    }
  })();

  const currentDocs = captain ? splitDocuments(captain.documents).current : [];

  const dialogs =
    captain && dialog && config ? (
      <ConfirmDialog
        isOpen
        title={config.title}
        description={config.description}
        targetEntityLabel={captain.name}
        confirmText={config.confirmText}
        isDestructive={config.destructive}
        requireReason={config.requireReason}
        minReasonLength={config.minReason}
        reasonPlaceholder={config.placeholder}
        confirmDisabled={config.disabled}
        onConfirm={submit}
        onCancel={() => setDialog(null)}
      >
        {dialog.kind === "doc-approve" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Expiry date on document
              <input type="date" value={approveExpiry} onChange={(e) => setApproveExpiry(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Document number (optional)
              <input type="text" value={approveNumber} onChange={(e) => setApproveNumber(e.target.value)} maxLength={64} placeholder="Confirm if different" className={inputCls} />
            </label>
          </div>
        )}

        {dialog.kind === "approve" && isSuperAdmin && (
          <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <input type="checkbox" checked={overrideDocs} onChange={(e) => setOverrideDocs(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              <strong>Override unverified documents (Super Admin).</strong> Uploaded documents that are still pending are marked verified by this approval. Missing, rejected or expired documents cannot be overridden. Requires a reason of 10+ characters.
            </span>
          </label>
        )}

        {dialog.kind === "reject" && (
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Days before the captain may reapply (optional, 0 = immediately)
            <input type="number" min={0} max={365} value={reapplyDays} onChange={(e) => setReapplyDays(e.target.value)} placeholder="Platform default" className={inputCls} />
          </label>
        )}

        {dialog.kind === "suspend" && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Automatic reactivation (optional)
              <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
            </label>
            <p className="text-xs text-slate-600 dark:text-slate-300">Leave empty for an open-ended suspension.</p>
          </div>
        )}

        {dialog.kind === "resubmit" && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Documents to re-upload{captain.status === "APPROVED" ? " (required)" : " (optional)"}</p>
            <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-[#331A3B] dark:border-[#331A3B]">
              {currentDocs.length === 0 && <p className="p-3 text-sm text-slate-600 dark:text-slate-300">No documents uploaded.</p>}
              {currentDocs.map((d) => (
                <label key={d.id} className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={resubmitIds.includes(d.id)}
                    onChange={(e) => setResubmitIds((ids) => (e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id)))}
                    className="h-4 w-4"
                  />
                  <span className="flex-1">{d.label}</span>
                  <Badge variant={documentStatusVariant(d.status)} size="sm">
                    {documentStatusLabel(d.status)}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        )}
      </ConfirmDialog>
    ) : null;

  return { openDialog, dialogs };
}
