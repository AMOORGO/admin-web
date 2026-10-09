"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw, RotateCcw, RotateCw, ShieldCheck, XCircle, ZoomIn, ZoomOut } from "lucide-react";
import { Can } from "@/components/Can";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Sheet } from "@/components/ui/Sheet";
import { StatusPill } from "@/components/ui/StatusPill";
import { api, errorMessage } from "@/lib/api";
import { type ApiSignedUrl, type ApiStaffDocument, displayDate, documentStatusLabel, documentStatusVariant, formatBytes, previewKind } from "@/lib/adapters/captains";
import { useNow } from "@/lib/safety/useNow";
import type { DialogState } from "./CaptainDialogs";

type PreviewState =
  | { phase: "error"; message: string }
  | { phase: "ready"; url: string; mimeType: string; documentNumber: string | null; expiresAt: number; renderFailed: boolean };

interface DocumentViewerProps {
  captainId: string;
  captainName: string;
  /** Documents the reviewer can step through (latest versions first). */
  docs: ApiStaffDocument[];
  currentId: string;
  onNavigate: (docId: string) => void;
  onClose: () => void;
  onAction: (d: DialogState) => void;
  /** A confirm dialog is open on top: keyboard shortcuts pause. */
  dialogOpen: boolean;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/**
 * Large document viewer (a Sheet of its own, not a side pane): prev / next through the captain's documents, zoom, rotate
 * (images), PDF embed, and the review actions right under the file. The signed URL is requested only when a document is
 * shown, and every request is written to the audit log by the API.
 */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({ captainId, captainName, docs, currentId, onNavigate, onClose, onAction, dialogOpen }) => {
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const inFlight = useRef(new Set<string>());
  const [view, setView] = useState<{ id: string; zoom: number; rot: number }>({ id: currentId, zoom: 1, rot: 0 });
  const [natural, setNatural] = useState<Record<string, { w: number; h: number }>>({});

  const index = Math.max(0, docs.findIndex((d) => d.id === currentId));
  const doc = docs[index];
  const preview = doc ? previews[doc.id] : undefined;
  const ready = preview?.phase === "ready";
  const now = useNow(1000, ready);
  const v = view.id === currentId ? view : { id: currentId, zoom: 1, rot: 0 };

  const load = useCallback(
    async (d: ApiStaffDocument) => {
      if (inFlight.current.has(d.id)) return;
      inFlight.current.add(d.id);
      try {
        const r = await api.get<ApiSignedUrl>(`/admin/captains/${captainId}/documents/${d.id}/url`);
        setPreviews((p) => ({ ...p, [d.id]: { phase: "ready", url: r.url, mimeType: r.mimeType || d.mimeType, documentNumber: r.documentNumber, expiresAt: Date.now() + r.expiresInSeconds * 1000, renderFailed: false } }));
      } catch (e) {
        setPreviews((p) => ({ ...p, [d.id]: { phase: "error", message: errorMessage(e) } }));
      } finally {
        inFlight.current.delete(d.id);
      }
    },
    [captainId],
  );

  // Request the link for the document on screen (never prefetched for the others).
  useEffect(() => {
    if (!doc) return;
    const existing = previews[doc.id];
    if (existing) return;
    void load(doc);
  }, [doc, previews, load]);

  const reload = (d: ApiStaffDocument) => {
    setPreviews((p) => {
      const rest = { ...p };
      delete rest[d.id];
      return rest;
    });
  };

  const go = useCallback(
    (delta: number) => {
      const next = docs[index + delta];
      if (next) onNavigate(next.id);
    },
    [docs, index, onNavigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, dialogOpen]);

  if (!doc) return null;

  const kind = preview?.phase === "ready" ? previewKind(preview.mimeType) : previewKind(doc.mimeType);
  const isImage = kind === "image" && !(preview?.phase === "ready" && preview.renderFailed);
  const remaining = preview?.phase === "ready" ? Math.max(0, Math.floor((preview.expiresAt - now) / 1000)) : 0;
  const linkExpired = preview?.phase === "ready" && remaining <= 0 && now > 0;
  const fullNumber = preview?.phase === "ready" && preview.documentNumber ? preview.documentNumber : doc.documentNumber;
  const setZoom = (z: number) => setView({ ...v, zoom: z });
  const stepZoom = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.findIndex((z) => z >= v.zoom - 0.001);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i < 0 ? 2 : i) + dir))];
    setZoom(next);
  };

  const toolbarBtn =
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-[#4B2757] dark:bg-[#211226] dark:text-slate-100 dark:hover:bg-[#28162E]";

  return (
    <Sheet
      open
      onClose={onClose}
      variant="center"
      fill
      widthClass="sm:max-w-6xl"
      bodyClassName="p-0 bg-slate-100 dark:bg-[#0F0811]"
      header={
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">{doc.label}</h2>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">v{doc.version}</span>
            <StatusPill variant={documentStatusVariant(doc.status)}>{documentStatusLabel(doc.status)}</StatusPill>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
            {captainName} • Document {index + 1} of {docs.length}
            {fullNumber ? ` • No. ${fullNumber}` : ""}
          </p>
        </div>
      }
      subheader={
        <div className="space-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={toolbarBtn} onClick={() => go(-1)} disabled={index === 0} aria-label="Previous document">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <button type="button" className={toolbarBtn} onClick={() => go(1)} disabled={index >= docs.length - 1} aria-label="Next document">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {isImage && preview?.phase === "ready" && !linkExpired && (
              <>
                <span className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-[#331A3B] sm:block" aria-hidden="true" />
                <button type="button" className={toolbarBtn} onClick={() => stepZoom(-1)} disabled={v.zoom <= ZOOM_STEPS[0]} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className={`${toolbarBtn} min-w-16 tabular-nums`} onClick={() => setZoom(1)} aria-label="Reset zoom to fit">
                  {Math.round(v.zoom * 100)}%
                </button>
                <button type="button" className={toolbarBtn} onClick={() => stepZoom(1)} disabled={v.zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className={toolbarBtn} onClick={() => setView({ ...v, rot: (v.rot + 270) % 360 })} aria-label="Rotate left">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className={toolbarBtn} onClick={() => setView({ ...v, rot: (v.rot + 90) % 360 })} aria-label="Rotate right">
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                </button>
              </>
            )}
            {preview?.phase === "ready" && !linkExpired && (
              <a href={preview.url} target="_blank" rel="noopener noreferrer" className={`${toolbarBtn} ml-auto`}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Open in new tab</span>
              </a>
            )}
          </div>
          <p className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#14755F] dark:text-[#4FD2B2]" aria-hidden="true" />
            Each time a document is opened the view is written to the audit log.
          </p>
        </div>
      }
      footer={
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Uploaded</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{displayDate(doc.uploadedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Expires</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{displayDate(doc.expiryDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">File</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{formatBytes(doc.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Link valid for</dt>
              <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{preview?.phase === "ready" && now > 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "—"}</dd>
            </div>
          </dl>
          {doc.rejectionReason && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Review note:</strong> {doc.rejectionReason}
            </p>
          )}
          <Can permission="captains.review_docs">
            <div className="flex flex-wrap items-center gap-2">
              {doc.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => onAction({ kind: "doc-approve", doc })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14755F] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0E3D32]"
                >
                  <CheckCircle className="h-4 w-4" aria-hidden="true" /> Approve
                </button>
              )}
              {(doc.status === "PENDING" || doc.status === "VERIFIED") && (
                <>
                  <button
                    type="button"
                    onClick={() => onAction({ kind: "doc-reject", doc })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-bold text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction({ kind: "doc-resubmit", doc })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Request re-upload
                  </button>
                </>
              )}
            </div>
          </Can>
        </div>
      }
    >
      <div className="flex h-full min-h-[50dvh] w-full items-start justify-center overflow-auto p-3 sm:p-6">
        {!preview ? (
          <div role="status" className="flex flex-col items-center gap-2 self-center text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            Requesting secure link…
          </div>
        ) : preview.phase === "error" ? (
          <div className="max-w-md space-y-3 self-center text-center">
            <ErrorBanner error={new Error(preview.message)} title="Could not open the document" />
            <button type="button" onClick={() => reload(doc)} className={toolbarBtn}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          </div>
        ) : linkExpired ? (
          <div className="max-w-md space-y-3 self-center text-center text-sm text-slate-700 dark:text-slate-200">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-base font-bold">The secure link has expired.</p>
            <p className="text-slate-600 dark:text-slate-300">Links are short-lived. Requesting a new one is recorded in the audit log again.</p>
            <button type="button" onClick={() => reload(doc)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3A102F] px-4 text-sm font-bold text-white hover:bg-[#521A44] dark:bg-[#7A2B66]">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload document
            </button>
          </div>
        ) : kind === "other" || preview.renderFailed ? (
          <div className="max-w-lg space-y-3 self-center rounded-2xl border border-slate-300 bg-white p-6 text-center text-sm text-slate-700 dark:border-[#4B2757] dark:bg-[#180D1C] dark:text-slate-200">
            <AlertTriangle className="mx-auto h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-base font-bold">{kind === "other" ? "This file type cannot be previewed in the browser." : "The document could not be loaded."}</p>
            {kind !== "other" && <p>The document storage may be unreachable from this browser, or the link has expired. You can retry or open the link directly.</p>}
            <div className="flex flex-wrap justify-center gap-2">
              <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3A102F] px-4 font-bold text-white hover:bg-[#521A44] dark:bg-[#7A2B66]">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open in new tab
              </a>
              <button type="button" onClick={() => reload(doc)} className={toolbarBtn}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
              </button>
            </div>
          </div>
        ) : kind === "image" ? (
          <ImageCanvas url={preview.url} alt={doc.label} zoom={v.zoom} rot={v.rot} natural={natural[doc.id]} onNatural={(n) => setNatural((m) => ({ ...m, [doc.id]: n }))} onError={() => setPreviews((p) => ({ ...p, [doc.id]: { ...preview, renderFailed: true } }))} />
        ) : (
          <iframe src={preview.url} title={doc.label} className="h-[62dvh] w-full rounded-xl border border-slate-300 bg-white dark:border-[#4B2757] sm:h-[66dvh]" />
        )}
      </div>
    </Sheet>
  );
};

/** Image with fit-to-screen at 100 %, zoom that scrolls (never clips) and 90-degree rotation. */
const ImageCanvas: React.FC<{ url: string; alt: string; zoom: number; rot: number; natural: { w: number; h: number } | undefined; onNatural: (n: { w: number; h: number }) => void; onError: () => void }> = ({ url, alt, zoom, rot, natural, onNatural, onError }) => {
  const rotated = rot % 180 !== 0;
  const base = natural && natural.w > 0 && natural.h > 0 ? natural.w / natural.h : 1.54;
  const aspect = rotated ? 1 / base : base;
  return (
    <div
      className="relative mx-auto shrink-0 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-slate-300 dark:ring-[#4B2757]"
      style={{ aspectRatio: String(aspect), width: `calc(min(100%, (100dvh - 27rem) * ${aspect.toFixed(4)}) * ${zoom})` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onLoad={(e) => onNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        onError={onError}
        className="absolute left-1/2 top-1/2 max-w-none transition-transform duration-200"
        style={{ width: rotated ? `${(1 / aspect) * 100}%` : "100%", height: "auto", transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
      />
    </div>
  );
};

