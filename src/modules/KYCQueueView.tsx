"use client";

import React from "react";
import {
  FileCheck,
  CheckCircle,
  XCircle,
  Clock,
  Car,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Heart,
} from "lucide-react";
import { Captain, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";

interface KYCQueueViewProps {
  captains: Captain[];
  selectedCity: string;
  role: StaffRole;
  onOpenKYCViewer: (captain: Captain) => void;
}

export const KYCQueueView: React.FC<KYCQueueViewProps> = ({
  captains,
  selectedCity,
  role,
  onOpenKYCViewer,
}) => {
  const pendingCaptains = captains.filter(
    (c) =>
      c.status === "PENDING_REVIEW" ||
      c.documents.some((d) => d.status === "PENDING" || d.status === "RESUBMISSION_REQUESTED")
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Title & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Driver KYC Approval Queue
            </h1>
            <Badge variant="plum" size="sm">
              P0 Priority Flow
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Verify driver licenses, vehicle registrations, commercial insurance, and background checks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Queue Size</span>
            <p className="font-mono font-black text-slate-900 dark:text-white">
              {pendingCaptains.length} Pending
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Avg Review SLA</span>
            <p className="font-mono font-black text-[#189578]">14 Mins</p>
          </div>
        </div>
      </div>

      {/* Applications Cards */}
      <div className="space-y-3">
        {pendingCaptains.length === 0 ? (
          <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-12 text-center space-y-3">
            <ShieldCheck className="h-12 w-12 text-[#189578] mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              All KYC Applications Processed
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are currently no driver applications waiting in the verification queue.
            </p>
          </div>
        ) : (
          pendingCaptains.map((cap) => {
            const pendingDocsCount = cap.documents.filter(
              (d) => d.status === "PENDING" || d.status === "RESUBMISSION_REQUESTED"
            ).length;

            return (
              <div
                key={cap.id}
                className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:shadow-md transition-all"
              >
                {/* Left: Applicant Bio & Vehicle */}
                <div className="flex items-center gap-4">
                  <img
                    src={cap.avatar}
                    alt={cap.name}
                    className="h-14 w-14 rounded-2xl object-cover border-2 border-[#7A2B66]"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {cap.name}
                      </h3>
                      <Badge variant="plum" size="sm">
                        {cap.city}
                      </Badge>
                      {cap.secondChance.isEnrolled && (
                        <Badge variant="coral" size="sm">
                          Second Chance
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Phone: {cap.phone} • Applied: {cap.joinedAt}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Car className="h-3.5 w-3.5 text-[#7A2B66] dark:text-[#DB99CC]" />
                      <span>
                        {cap.vehicle.make} {cap.vehicle.model} ({cap.vehicle.year}) • Plate:{" "}
                        <span className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                          {cap.vehicle.plateNumber}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Center: Documents Status Strip */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {cap.documents.map((d) => (
                    <div
                      key={d.id}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                        d.status === "VERIFIED"
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                          : d.status === "RESUBMISSION_REQUESTED"
                          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300"
                          : "bg-slate-50 dark:bg-[#211226] border-slate-200 dark:border-[#331A3B] text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <FileText className="h-3 w-3" />
                      <span className="font-semibold">{d.title.split(" ")[0]}</span>
                      <span className="text-[10px] uppercase font-bold">
                        ({d.status === "VERIFIED" ? "✓" : "!"})
                      </span>
                    </div>
                  ))}
                </div>

                {/* Right: Inspection CTA */}
                <button
                  onClick={() => onOpenKYCViewer(cap)}
                  className="rounded-xl bg-[#3A102F] hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490] text-white px-5 py-2.5 text-xs font-bold transition-all shadow-md flex items-center gap-2 whitespace-nowrap self-stretch lg:self-auto justify-center"
                >
                  <span>Open Verification Workbench</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
