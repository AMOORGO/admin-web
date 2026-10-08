"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Hash,
  Car,
  Heart,
} from "lucide-react";
import { Captain, CaptainDocument, StaffRole } from "@/types";
import { Badge } from "./Badge";
import { Can } from "./Can";
import { ConfirmDialog } from "./ConfirmDialog";

interface KYCDocumentViewerProps {
  captain: Captain | null;
  role: StaffRole;
  onClose: () => void;
  onApprove: (captainId: string, reason: string) => void;
  onReject: (captainId: string, reason: string) => void;
  onRequestResubmission: (captainId: string, docId: string, note: string) => void;
  onEnrollSecondChance?: (captainId: string) => void;
}

export const KYCDocumentViewer: React.FC<KYCDocumentViewerProps> = ({
  captain,
  role,
  onClose,
  onApprove,
  onReject,
  onRequestResubmission,
  onEnrollSecondChance,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [resubmitNote, setResubmitNote] = useState("");

  if (!captain) return null;

  const currentDoc =
    captain.documents.find((d) => d.id === selectedDocId) ||
    captain.documents[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4 bg-[#FAF0F7]/40 dark:bg-[#211226]/50">
          <div className="flex items-center gap-4">
            <img
              src={captain.avatar}
              alt={captain.name}
              className="h-11 w-11 rounded-full object-cover border-2 border-[#7A2B66]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  KYC Verification: {captain.name}
                </h3>
                <Badge variant="plum" size="sm">
                  {captain.city}
                </Badge>
                {captain.secondChance.isEnrolled && (
                  <Badge variant="coral" size="sm">
                    Second Chance Eligible
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Phone: {captain.phone} • Email: {captain.email} • Applied: {captain.joinedAt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#28162E] dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Split Screen Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Documents Selector & Applicant Meta (35%) */}
          <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-[#F0E3ED] dark:border-[#331A3B] flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-[#211226]/30 p-5 space-y-5">
            {/* Vehicle Info Card */}
            <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Car className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
                Registered Vehicle
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-800 dark:text-white text-sm">
                  {captain.vehicle.make} {captain.vehicle.model} ({captain.vehicle.year})
                </p>
                <div className="flex justify-between text-slate-500">
                  <span>Plate Number:</span>
                  <span className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                    {captain.vehicle.plateNumber}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Color / Fuel:</span>
                  <span>{captain.vehicle.color} • {captain.vehicle.isElectric ? "100% Electric (EV)" : "Hybrid/Gas"}</span>
                </div>
              </div>
            </div>

            {/* Document List */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Submitted Verification Documents ({captain.documents.length})
              </span>
              <div className="space-y-2">
                {captain.documents.map((doc) => {
                  const isSelected = (currentDoc?.id === doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setZoomLevel(1);
                      }}
                      className={`w-full text-left rounded-xl border p-3 text-xs transition-all flex items-start justify-between gap-2 ${
                        isSelected
                          ? "border-[#7A2B66] bg-[#FAF0F7] dark:bg-[#331A3B]/40 shadow-xs"
                          : "border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] hover:border-slate-300"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className={`h-4 w-4 ${isSelected ? "text-[#7A2B66] dark:text-[#E9BFDF]" : "text-slate-400"}`} />
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {doc.title}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                          Doc #: {doc.documentNumber}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Expires: {doc.expiryDate}
                        </p>
                      </div>

                      <Badge
                        variant={
                          doc.status === "VERIFIED"
                            ? "teal"
                            : doc.status === "RESUBMISSION_REQUESTED"
                            ? "warning"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {doc.status.replace("_", " ")}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Second Chance Eligibility Recommendation */}
            <div className="rounded-xl border border-rose-200 dark:border-rose-950/60 bg-[#FFF3F1] dark:bg-[#38110D]/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#F94B35] font-bold text-xs">
                <Heart className="h-4 w-4 fill-current" />
                AmoorGo Second Chance Consideration
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                If applicant has minor background gaps, they may qualify under PRD Section 28 for probationary onboarding with telemetry governor.
              </p>
              {onEnrollSecondChance && !captain.secondChance.isEnrolled && (
                <button
                  onClick={() => onEnrollSecondChance(captain.id)}
                  className="w-full rounded-lg bg-white dark:bg-[#180D1C] border border-[#F94B35] text-[#F94B35] py-1.5 text-xs font-bold hover:bg-[#F94B35] hover:text-white transition-all text-center"
                >
                  Mark Eligible for Second Chance
                </button>
              )}
            </div>
          </div>

          {/* Right Column: High-Res Document Preview & Inspection (65%) */}
          <div className="flex-1 flex flex-col bg-slate-100 dark:bg-[#100713] overflow-hidden">
            {/* Viewer Controls */}
            {currentDoc && (
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#331A3B] px-5 py-3 bg-white dark:bg-[#180D1C]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    {currentDoc.title}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {currentDoc.documentNumber}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-1">
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                      className="p-1 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                      className="p-1 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => setShowResubmitModal(true)}
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1.5 text-xs font-bold hover:bg-amber-100 transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Request Re-upload
                  </button>
                </div>
              </div>
            )}

            {/* Document Canvas */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
              {currentDoc ? (
                <div
                  className="transition-transform duration-200 shadow-xl rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 max-w-full"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={currentDoc.fileUrl}
                    alt={currentDoc.title}
                    className="max-h-[560px] object-contain bg-white"
                  />
                  {currentDoc.rejectionReason && (
                    <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs border-t border-amber-300">
                      <strong>Resubmission Note:</strong> {currentDoc.rejectionReason}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-slate-400 text-sm">
                  No document selected.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Review Actions Footer */}
        <div className="border-t border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4 bg-white dark:bg-[#180D1C] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#189578]" />
            <span>
              All KYC checks comply with State Transportation Network Company (TNC) standards.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Can role={role} permission="captains.approve">
              <button
                onClick={() => setShowRejectDialog(true)}
                className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-5 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reject Application
              </button>
            </Can>

            <Can role={role} permission="captains.approve">
              <button
                onClick={() => setShowApproveDialog(true)}
                className="rounded-xl bg-[#189578] hover:bg-[#14755F] px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Approve & Activate Captain
              </button>
            </Can>
          </div>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showApproveDialog}
        title="Approve Captain Application"
        description={`This will activate ${captain.name} on the AMOORGO Captain platform, issuing active credentials and enabling them to receive dispatch offers.`}
        targetEntityLabel={captain.name}
        confirmText="Confirm Approval & Issue License"
        isDestructive={false}
        requireReason={true}
        reasonPlaceholder="Approval notes (e.g. All documents verified against Texas DPS database)..."
        onConfirm={(reason) => {
          setShowApproveDialog(false);
          onApprove(captain.id, reason);
        }}
        onCancel={() => setShowApproveDialog(false)}
      />

      {/* Reject Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRejectDialog}
        title="Reject Captain Application"
        description={`This will permanently deny ${captain.name}'s application and send an automated notification with the justification entered below.`}
        targetEntityLabel={captain.name}
        confirmText="Reject Application"
        isDestructive={true}
        requireReason={true}
        reasonPlaceholder="Specify rejection ground (e.g. Disqualified MVR driving record, expired commercial insurance, fraudulent credentials)..."
        onConfirm={(reason) => {
          setShowRejectDialog(false);
          onReject(captain.id, reason);
        }}
        onCancel={() => setShowRejectDialog(false)}
      />

      {/* Resubmission Modal */}
      {showResubmitModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Request Document Resubmission
            </h3>
            <p className="text-xs text-slate-500">
              Provide feedback for <strong>{currentDoc?.title}</strong> so the captain can upload an acceptable replacement.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Document image is blurry and edges are cut off. Please upload a flat scanned PDF..."
              value={resubmitNote}
              onChange={(e) => setResubmitNote(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-3 text-xs dark:bg-[#211226] dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResubmitModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!resubmitNote}
                onClick={() => {
                  if (currentDoc) {
                    onRequestResubmission(captain.id, currentDoc.id, resubmitNote);
                  }
                  setShowResubmitModal(false);
                  setResubmitNote("");
                }}
                className="rounded-xl bg-[#3A102F] text-white px-4 py-2 text-xs font-bold hover:bg-[#521A44] disabled:opacity-40"
              >
                Send Request to Driver App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
