"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  Car,
  Heart,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Badge } from "./Badge";
import { Can } from "./Can";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorBanner } from "./ui/ErrorBanner";
import { Sheet } from "./ui/Sheet";
import { Skeleton } from "./ui/Skeleton";
import { useToast } from "./ui/Toast";
import { api, errorMessage } from "@/lib/api";
import {
  ApiCaptainDetail,
  ApiSignedUrl,
  ApiStaffDocument,
  ApiVehicle,
  ApiVehicleStatus,
  captainStatusLabel,
  captainStatusVariant,
  checklistStateVariant,
  cityLabel,
  displayDate,
  documentStatusLabel,
  documentStatusVariant,
  formatBytes,
  previewKind,
  toCaptainStatus,
} from "@/lib/adapters/captains";
import { avatarFor, formatDateTime, humanize } from "@/lib/format";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";

interface KYCDocumentViewerProps {
  captainId: string | null;
  onClose: () => void;
}

export const KYCDocumentViewer: React.FC<KYCDocumentViewerProps> = ({ captainId, onClose }) => {
  if (!captainId) return null;
  // keyed so that every captain starts with a clean selection / preview cache
  return <ViewerInner key={captainId} captainId={captainId} onClose={onClose} />;
};

type PreviewState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; url: string; mimeType: string; documentNumber: string | null; expiresAt: number; renderFailed: boolean };

type DialogState =
  | { kind: "doc-approve"; doc: ApiStaffDocument }
  | { kind: "doc-reject"; doc: ApiStaffDocument }
  | { kind: "doc-resubmit"; doc: ApiStaffDocument }
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "resubmit" }
  | { kind: "vehicle"; vehicle: ApiVehicle; status: ApiVehicleStatus; makePrimary: boolean };

const REVIEWABLE_APPLICATION = ["SUBMITTED", "UNDER_REVIEW"];

const ViewerInner: React.FC<{ captainId: string; onClose: () => void }> = ({ captainId, onClose }) => {
  const toast = useToast();
  const { user } = useAuth();
  const { cities } = useCities();
  const isSuperAdmin = !!user?.roles.includes("SUPER_ADMIN");

  const detailQuery = useQuery<ApiCaptainDetail>(`kyc-captain:${captainId}`, (signal) =>
    api.get<ApiCaptainDetail>(`/admin/captains/${captainId}`, { signal }),
  );
  useOnInvalidate(["captains", "kyc"], detailQuery.refetch);
  const captain = detailQuery.data;

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const [now, setNow] = useState(() => Date.now());
  const [showOld, setShowOld] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // extra fields of the open dialog
  const [approveExpiry, setApproveExpiry] = useState("");
  const [approveNumber, setApproveNumber] = useState("");
  const [overrideDocs, setOverrideDocs] = useState(false);
  const [reapplyDays, setReapplyDays] = useState("");
  const [resubmitIds, setResubmitIds] = useState<string[]>([]);

  const currentPreview = selectedDocId ? previews[selectedDocId] : undefined;
  const ticking = currentPreview?.phase === "ready";
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const docs = useMemo(() => captain?.documents ?? [], [captain]);
  /** Latest version per (type, vehicle); the API returns type asc, version desc. */
  const { currentDocs, olderDocs } = useMemo(() => {
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
    return { currentDocs: current, olderDocs: older };
  }, [docs]);

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null;

  /** Fetches the audited signed URL. Called ONLY when the operator opens a document (never prefetched). */
  const openDocument = async (doc: ApiStaffDocument, force = false) => {
    setSelectedDocId(doc.id);
    setZoomLevel(1);
    const existing = previews[doc.id];
    if (!force && existing && (existing.phase === "loading" || (existing.phase === "ready" && existing.expiresAt > Date.now()))) return;
    setPreviews((p) => ({ ...p, [doc.id]: { phase: "loading" } }));
    try {
      const r = await api.get<ApiSignedUrl>(`/admin/captains/${captainId}/documents/${doc.id}/url`);
      setPreviews((p) => ({
        ...p,
        [doc.id]: { phase: "ready", url: r.url, mimeType: r.mimeType || doc.mimeType, documentNumber: r.documentNumber, expiresAt: Date.now() + r.expiresInSeconds * 1000, renderFailed: false },
      }));
      setNow(Date.now());
    } catch (e) {
      setPreviews((p) => ({ ...p, [doc.id]: { phase: "error", message: errorMessage(e) } }));
    }
  };

  const markRenderFailed = (docId: string) =>
    setPreviews((p) => {
      const cur = p[docId];
      return cur && cur.phase === "ready" ? { ...p, [docId]: { ...cur, renderFailed: true } } : p;
    });

  const afterMutation = (message: string) => {
    toast.success(message);
    invalidate("captains", "kyc");
    detailQuery.refetch();
    setDialog(null);
  };

  const openDialog = (d: DialogState) => {
    setApproveExpiry(d.kind === "doc-approve" ? (d.doc.expiryDate ?? "") : "");
    setApproveNumber("");
    setOverrideDocs(false);
    setReapplyDays("");
    setResubmitIds(d.kind === "doc-resubmit" ? [d.doc.id] : []);
    setDialog(d);
  };

  /** Runs the request for the open dialog; throws (shown inside the dialog) on backend errors. */
  const submitDialog = async (reason: string): Promise<boolean> => {
    if (!captain || !dialog) return false;
    switch (dialog.kind) {
      case "doc-approve": {
        await api.patch(`/admin/captains/${captainId}/documents/${dialog.doc.id}`, {
          action: "APPROVE",
          ...(approveExpiry ? { expiresAt: approveExpiry } : {}),
          ...(approveNumber.trim() ? { documentNumber: approveNumber.trim() } : {}),
        });
        afterMutation(`${dialog.doc.label} approved`);
        return true;
      }
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
      case "vehicle":
        await api.patch(`/admin/captains/${captainId}/vehicles/${dialog.vehicle.id}`, { reason, status: dialog.status, ...(dialog.makePrimary ? { isPrimary: true } : {}) });
        afterMutation(`Vehicle ${dialog.vehicle.plateNumber} updated`);
        return true;
    }
  };

  const dialogConfig = (() => {
    if (!captain || !dialog) return null;
    switch (dialog.kind) {
      case "doc-approve":
        return {
          title: `Approve ${dialog.doc.label}`,
          description: "Confirm the document is legible, genuine and matches the captain. The expiry date must be the one printed on the document.",
          confirmText: "Approve Document",
          destructive: false,
          requireReason: false,
          minReason: 3,
          placeholder: "",
          confirmDisabled: false,
        };
      case "doc-reject":
        return {
          title: `Reject ${dialog.doc.label}`,
          description: "The document is marked REJECTED and the captain is notified with the reason below.",
          confirmText: "Reject Document",
          destructive: true,
          requireReason: true,
          minReason: 3,
          placeholder: "e.g. Document belongs to a different person, fraudulent credentials...",
          confirmDisabled: false,
        };
      case "doc-resubmit":
        return {
          title: `Request re-upload of ${dialog.doc.label}`,
          description: "The captain is asked to upload a replacement; the reason is shown in the driver app.",
          confirmText: "Send Request to Driver App",
          destructive: false,
          requireReason: true,
          minReason: 3,
          placeholder: "e.g. Image is blurry and edges are cut off. Please upload a flat scan...",
          confirmDisabled: false,
        };
      case "approve":
        return {
          title: "Approve Captain Application",
          description: `This will activate ${captain.name} on the AMOORGO Captain platform, enabling them to receive dispatch offers.`,
          confirmText: "Confirm Approval",
          destructive: false,
          requireReason: true,
          minReason: overrideDocs ? 10 : 3,
          placeholder: overrideDocs ? "Override justification (10+ characters)..." : "Approval notes (e.g. All documents verified)...",
          confirmDisabled: false,
        };
      case "reject":
        return {
          title: "Reject Captain Application",
          description: `This will deny ${captain.name}'s application and notify them with the justification below.`,
          confirmText: "Reject Application",
          destructive: true,
          requireReason: true,
          minReason: 3,
          placeholder: "e.g. Disqualified driving record, fraudulent credentials...",
          confirmDisabled: false,
        };
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
          confirmDisabled: captain.status === "APPROVED" && resubmitIds.length === 0,
        };
      case "vehicle":
        return {
          title: dialog.makePrimary ? "Make Vehicle Primary" : `Set Vehicle ${humanize(dialog.status)}`,
          description: `${dialog.vehicle.make} ${dialog.vehicle.model} (${dialog.vehicle.plateNumber})`,
          confirmText: "Confirm",
          destructive: dialog.status === "REJECTED",
          requireReason: true,
          minReason: 3,
          placeholder: "Reason for the vehicle review decision...",
          confirmDisabled: false,
        };
    }
  })();

  const status = captain ? toCaptainStatus(captain.status, captain.availability, captain.onRide) : null;
  const inReview = !!captain && REVIEWABLE_APPLICATION.includes(captain.status);

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        variant="center"
        fill
        widthClass="sm:max-w-6xl"
        headerClassName="bg-[#FAF0F7]/40 dark:bg-[#211226]/50"
        bodyClassName="p-0 lg:overflow-hidden"
        header={
          <>
          {captain && status ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarFor(captain.name, captain.avatar)} alt={captain.name} className="h-11 w-11 rounded-full object-cover border-2 border-[#7A2B66]" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">KYC Verification: {captain.name}</h3>
                  <Badge variant="plum" size="sm">
                    {cityLabel(captain.cityId, captain.city, cities)}
                  </Badge>
                  <Badge variant={captainStatusVariant(status)} size="sm" dot>
                    {captainStatusLabel(status)}
                  </Badge>
                  {captain.isSecondChance && (
                    <Badge variant="coral" size="sm">
                      Second Chance
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Phone: {captain.phone} • Email: {captain.email ?? "—"} • Applied: {displayDate(captain.submittedAt ?? captain.joinedAt)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-72" />
              </div>
            </div>
          )}
          </>
        }
        footer={
          captain ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="hidden items-center gap-2 text-xs text-slate-600 dark:text-slate-300 sm:flex">
                <ShieldCheck className="h-4 w-4 text-[#14755F] dark:text-[#4FD2B2]" />
                <span>
                  {inReview
                    ? "Verify every required document, then approve, reject or send the application back."
                    : `Application status: ${status ? captainStatusLabel(status) : ""}.`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                {(inReview || captain.status === "APPROVED") && (
                  <Can permission="captains.approve">
                    <button
                      onClick={() => openDialog({ kind: "resubmit" })}
                      className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-all flex items-center justify-center gap-2 sm:px-4"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Request Resubmission
                    </button>
                  </Can>
                )}
                {inReview && (
                  <>
                    <Can permission="captains.approve">
                      <button
                        onClick={() => openDialog({ kind: "reject" })}
                        className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all flex items-center justify-center gap-2 sm:px-5"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject Application
                      </button>
                    </Can>
                    <Can permission="captains.approve">
                      <button
                        onClick={() => openDialog({ kind: "approve" })}
                        className="rounded-xl bg-[#14755F] hover:bg-[#0E3D32] px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 max-sm:col-span-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve &amp; Activate Captain
                      </button>
                    </Can>
                  </>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {detailQuery.error && !captain && (
          <div className="p-6">
            <ErrorBanner error={detailQuery.error} title="Could not load the captain" onRetry={detailQuery.refetch} />
          </div>
        )}

        {!captain && !detailQuery.error && (
          <div className="flex-1 p-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {captain && (
          <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
              {/* Left Column: Documents Selector & Applicant Meta */}
              <div className="flex w-full shrink-0 flex-col space-y-5 border-b border-[#F0E3ED] bg-slate-50/50 p-4 dark:border-[#331A3B] dark:bg-[#211226]/30 sm:p-5 lg:w-96 lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r">
                {detailQuery.error && <ErrorBanner error={detailQuery.error} title="Could not refresh the captain" onRetry={detailQuery.refetch} />}
                {captain.statusReason && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <strong>Last status note:</strong> {captain.statusReason}
                  </div>
                )}

                {/* Vehicles */}
                <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Car className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
                    Registered Vehicles ({captain.vehicles.length})
                  </div>
                  {captain.vehicles.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No vehicle registered yet.</p>}
                  {captain.vehicles.map((v) => (
                    <div key={v.id} className="text-xs space-y-1 border-t first:border-t-0 border-slate-100 dark:border-[#331A3B] pt-2 first:pt-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-800 dark:text-white text-sm">
                          {v.make} {v.model} ({v.year})
                        </p>
                        <div className="flex gap-1">
                          {v.isPrimary && (
                            <Badge variant="plum" size="sm">
                              Primary
                            </Badge>
                          )}
                          <Badge variant={v.status === "ACTIVE" ? "teal" : v.status === "PENDING_REVIEW" ? "warning" : "coral"} size="sm">
                            {humanize(v.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Plate Number:</span>
                        <span className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                          {v.plateNumber}
                          {v.plateState ? ` (${v.plateState})` : ""}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Color / Fuel:</span>
                        <span>
                          {v.color} • {v.isElectric ? "Electric (EV)" : "Gas / Hybrid"} • {v.seats} seats
                        </span>
                      </div>
                      <Can permission="captains.edit">
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {v.status !== "ACTIVE" && (
                            <button
                              onClick={() => openDialog({ kind: "vehicle", vehicle: v, status: "ACTIVE", makePrimary: false })}
                              className="rounded-lg border border-[#B4F2E1] bg-[#EFFCF9] text-[#14755F] px-2 py-1 text-[11px] font-bold hover:opacity-80"
                            >
                              Activate
                            </button>
                          )}
                          {v.status !== "REJECTED" && (
                            <button
                              onClick={() => openDialog({ kind: "vehicle", vehicle: v, status: "REJECTED", makePrimary: false })}
                              className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-2 py-1 text-[11px] font-bold hover:bg-rose-100"
                            >
                              Reject
                            </button>
                          )}
                          {v.status === "ACTIVE" && !v.isPrimary && (
                            <button
                              onClick={() => openDialog({ kind: "vehicle", vehicle: v, status: "ACTIVE", makePrimary: true })}
                              className="rounded-lg border border-slate-200 dark:border-[#331A3B] px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E]"
                            >
                              Make primary
                            </button>
                          )}
                        </div>
                      </Can>
                    </div>
                  ))}
                </div>

                {/* Document List */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Submitted Verification Documents ({currentDocs.length})</span>
                  {currentDocs.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No documents uploaded yet.</p>}
                  <div className="space-y-2">
                    {[...currentDocs, ...(showOld ? olderDocs : [])].map((doc) => {
                      const isSelected = selectedDocId === doc.id;
                      const superseded = olderDocs.includes(doc);
                      return (
                        <button
                          key={doc.id}
                          onClick={() => openDocument(doc)}
                          className={`w-full text-left rounded-xl border p-3 text-xs transition-all flex items-start justify-between gap-2 ${
                            isSelected
                              ? "border-[#7A2B66] bg-[#FAF0F7] dark:bg-[#331A3B]/40 shadow-xs"
                              : "border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] hover:border-slate-300"
                          } ${superseded ? "opacity-70" : ""}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className={`h-4 w-4 ${isSelected ? "text-[#7A2B66] dark:text-[#E9BFDF]" : "text-slate-400"}`} />
                              <span className="font-bold text-slate-800 dark:text-slate-100">{doc.label}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">v{doc.version}</span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Doc #: {doc.documentNumber ?? "—"}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              Uploaded {displayDate(doc.uploadedAt)} • Expires: {displayDate(doc.expiryDate)}
                            </p>
                            {doc.rejectionReason && <p className="text-[10px] text-amber-700 dark:text-amber-300">Note: {doc.rejectionReason}</p>}
                          </div>
                          <Badge variant={documentStatusVariant(doc.status)} size="sm">
                            {documentStatusLabel(doc.status)}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                  {olderDocs.length > 0 && (
                    <button onClick={() => setShowOld((v) => !v)} className="text-[11px] font-bold text-[#7A2B66] dark:text-[#DB99CC] hover:underline">
                      {showOld ? "Hide" : "Show"} older versions ({olderDocs.length})
                    </button>
                  )}
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Opening a document is recorded in the audit log.</p>
                </div>

                {/* Compliance checklist */}
                {captain.documentChecklist.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Required documents</span>
                      <Badge variant={captain.eligibility.eligible ? "teal" : "warning"} size="sm">
                        {captain.eligibility.eligible ? "Eligible to drive" : "Not eligible yet"}
                      </Badge>
                    </div>
                    {captain.documentChecklist.map((i) => (
                      <div key={`${i.documentType}:${i.vehicleId ?? ""}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700 dark:text-slate-300">{i.label}</span>
                        <Badge variant={checklistStateVariant(i.state)} size="sm">
                          {humanize(i.state)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Second Chance context (the backend has no admin enrol path: drivers apply from the app) */}
                {captain.isSecondChance && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-950/60 bg-[#FFF3F1] dark:bg-[#38110D]/40 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[#D93320] dark:text-[#FF7361] font-bold text-xs">
                      <Heart className="h-4 w-4 fill-current" />
                      AmoorGo Second Chance applicant
                    </div>
                    {captain.secondChance ? (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Programme status: <strong>{humanize(captain.secondChance.status)}</strong> • {humanize(captain.secondChance.tier)}. Manage the programme record in the Second Chance tab.
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">Flagged as a Second Chance driver.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Document Preview & Inspection */}
              <div className="flex min-h-[60dvh] min-w-0 flex-1 flex-col overflow-hidden bg-slate-100 dark:bg-[#100713] lg:min-h-0">
                {selectedDoc && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-[#331A3B] px-5 py-3 bg-white dark:bg-[#180D1C]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {selectedDoc.label} <span className="text-slate-500 dark:text-slate-400 font-normal">v{selectedDoc.version}</span>
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        ID: {currentPreview?.phase === "ready" && currentPreview.documentNumber ? currentPreview.documentNumber : (selectedDoc.documentNumber ?? "—")}
                      </span>
                      <Badge variant={documentStatusVariant(selectedDoc.status)} size="sm">
                        {documentStatusLabel(selectedDoc.status)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {currentPreview?.phase === "ready" && previewKind(currentPreview.mimeType) === "image" && !currentPreview.renderFailed && (
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-1">
                          <button onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))} className="p-1 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white" title="Zoom Out">
                            <ZoomOut className="h-4 w-4" />
                          </button>
                          <span className="px-2 text-xs font-mono text-slate-600 dark:text-slate-300">{Math.round(zoomLevel * 100)}%</span>
                          <button onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))} className="p-1 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white" title="Zoom In">
                            <ZoomIn className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      <Can permission="captains.review_docs">
                        {selectedDoc.status === "PENDING" && (
                          <button
                            onClick={() => openDialog({ kind: "doc-approve", doc: selectedDoc })}
                            className="rounded-lg border border-[#B4F2E1] dark:border-[#14755F] bg-[#EFFCF9] dark:bg-[#0D2620] text-[#14755F] dark:text-[#82E5CB] px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-all flex items-center gap-1.5"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        {(selectedDoc.status === "PENDING" || selectedDoc.status === "VERIFIED") && (
                          <>
                            <button
                              onClick={() => openDialog({ kind: "doc-reject", doc: selectedDoc })}
                              className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-1.5"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                            <button
                              onClick={() => openDialog({ kind: "doc-resubmit", doc: selectedDoc })}
                              className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1.5 text-xs font-bold hover:bg-amber-100 transition-all flex items-center gap-1.5"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Request Re-upload
                            </button>
                          </>
                        )}
                      </Can>
                    </div>
                  </div>
                )}

                {/* Document Canvas */}
                <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
                  {!selectedDoc ? (
                    <div className="text-center text-slate-500 dark:text-slate-400 text-sm space-y-2">
                      <Eye className="h-8 w-8 mx-auto opacity-60" />
                      <p>Select a document on the left to open it.</p>
                      <p className="text-xs">Each time a document is opened the view is written to the audit log.</p>
                    </div>
                  ) : (
                    <DocumentCanvas
                      doc={selectedDoc}
                      preview={currentPreview}
                      now={now}
                      zoom={zoomLevel}
                      onReload={() => openDocument(selectedDoc, true)}
                      onRenderFailed={() => markRenderFailed(selectedDoc.id)}
                    />
                  )}
                </div>
              </div>
          </div>
        )}
      </Sheet>

      {captain && dialog && dialogConfig && (
        <ConfirmDialog
          isOpen
          title={dialogConfig.title}
          description={dialogConfig.description}
          targetEntityLabel={captain.name}
          confirmText={dialogConfig.confirmText}
          isDestructive={dialogConfig.destructive}
          requireReason={dialogConfig.requireReason}
          minReasonLength={dialogConfig.minReason}
          reasonPlaceholder={dialogConfig.placeholder}
          confirmDisabled={dialogConfig.confirmDisabled}
          onConfirm={submitDialog}
          onCancel={() => setDialog(null)}
        >
          {dialog.kind === "doc-approve" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Expiry date on document
                <input
                  type="date"
                  value={approveExpiry}
                  onChange={(e) => setApproveExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2 text-sm text-slate-900 dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Document number (optional)
                <input
                  type="text"
                  value={approveNumber}
                  onChange={(e) => setApproveNumber(e.target.value)}
                  maxLength={64}
                  placeholder="Confirm if different"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2 text-sm text-slate-900 dark:text-white"
                />
              </label>
            </div>
          )}

          {dialog.kind === "approve" && isSuperAdmin && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <input type="checkbox" checked={overrideDocs} onChange={(e) => setOverrideDocs(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                <strong>Override unverified documents (Super Admin).</strong> Uploaded documents that are still pending are marked verified by this approval. Missing, rejected or expired documents cannot be overridden. Requires a reason of 10+ characters.
              </span>
            </label>
          )}

          {dialog.kind === "reject" && (
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Days before the captain may reapply (optional, 0 = immediately)
              <input
                type="number"
                min={0}
                max={365}
                value={reapplyDays}
                onChange={(e) => setReapplyDays(e.target.value)}
                placeholder="Platform default"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2 text-sm text-slate-900 dark:text-white"
              />
            </label>
          )}

          {dialog.kind === "resubmit" && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Documents to re-upload{captain.status === "APPROVED" ? " (required)" : " (optional)"}
              </p>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#331A3B] divide-y divide-slate-100 dark:divide-[#331A3B]">
                {currentDocs.length === 0 && <p className="p-3 text-xs text-slate-500 dark:text-slate-400">No documents uploaded.</p>}
                {currentDocs.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
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
      )}
    </>
  );
};

/** Preview area for the selected document: loading / error / image / pdf / render-failure fallback. */
const DocumentCanvas: React.FC<{
  doc: ApiStaffDocument;
  preview: PreviewState | undefined;
  now: number;
  zoom: number;
  onReload: () => void;
  onRenderFailed: () => void;
}> = ({ doc, preview, now, zoom, onReload, onRenderFailed }) => {
  if (!preview || preview.phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400 text-sm" role="status">
        <Loader2 className="h-6 w-6 animate-spin" />
        Requesting secure link…
      </div>
    );
  }

  if (preview.phase === "error") {
    return (
      <div className="max-w-md space-y-3 text-center">
        <ErrorBanner error={new Error(preview.message)} title="Could not open the document" />
        <button onClick={onReload} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#331A3B] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#28162E]">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }

  const remaining = Math.max(0, Math.floor((preview.expiresAt - now) / 1000));
  const expired = remaining <= 0;
  const kind = previewKind(preview.mimeType);
  const meta = `${preview.mimeType} • ${formatBytes(doc.sizeBytes)} • uploaded ${formatDateTime(doc.uploadedAt)}`;

  if (expired) {
    return (
      <div className="max-w-md space-y-3 text-center text-sm text-slate-600 dark:text-slate-300">
        <AlertTriangle className="h-8 w-8 mx-auto text-amber-700 dark:text-amber-400" />
        <p className="font-bold">The secure link has expired.</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Links are short-lived. Requesting a new one is recorded in the audit log again.</p>
        <button onClick={onReload} className="inline-flex items-center gap-1.5 rounded-lg bg-[#3A102F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#521A44]">
          <RefreshCw className="h-3.5 w-3.5" /> Reload document
        </button>
      </div>
    );
  }

  const failed = preview.renderFailed || kind === "other";
  return (
    <div className="flex w-full h-full flex-col items-center justify-center gap-3">
      {failed ? (
        <div className="max-w-lg space-y-3 rounded-xl border border-slate-300 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 text-center text-xs text-slate-600 dark:text-slate-300">
          <AlertTriangle className="h-7 w-7 mx-auto text-amber-700 dark:text-amber-400" />
          <p className="font-bold text-sm">{kind === "other" ? "This file type cannot be previewed in the browser." : "The document could not be loaded."}</p>
          {kind !== "other" && <p>The document storage may be unreachable from this browser, or the link has expired. You can retry or open the link directly.</p>}
          <input readOnly value={preview.url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2 font-mono text-[10px]" aria-label="Signed document URL" />
          <div className="flex justify-center gap-2">
            <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#3A102F] px-3 py-1.5 font-bold text-white hover:bg-[#521A44]">
              <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
            </a>
            <button onClick={onReload} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#331A3B] px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E]">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      ) : kind === "image" ? (
        <div className="transition-transform duration-200 shadow-xl rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 max-w-full" style={{ transform: `scale(${zoom})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={doc.label} onError={onRenderFailed} className="max-h-[560px] object-contain bg-white" />
          {doc.rejectionReason && (
            <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs border-t border-amber-300">
              <strong>Review note:</strong> {doc.rejectionReason}
            </div>
          )}
        </div>
      ) : (
        <iframe src={preview.url} title={doc.label} className="w-full flex-1 min-h-[420px] rounded-xl border border-slate-300 dark:border-slate-800 bg-white" />
      )}
      {!failed && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{meta}</span>
          <span>Link expires in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
          <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[#7A2B66] dark:text-[#DB99CC] hover:underline">
            <ExternalLink className="h-3 w-3" /> Open in new tab
          </a>
        </div>
      )}
    </div>
  );
};
