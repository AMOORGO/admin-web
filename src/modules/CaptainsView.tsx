"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Car,
  DollarSign,
  Heart,
  ShieldAlert,
  Eye,
  Sliders,
  Award,
} from "lucide-react";
import { Captain, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface CaptainsViewProps {
  captains: Captain[];
  selectedCity: string;
  role: StaffRole;
  onOpenKYCViewer: (captain: Captain) => void;
  onToggleSuspend: (captainId: string, reason: string) => void;
  onNavigateToSecondChance: () => void;
}

export const CaptainsView: React.FC<CaptainsViewProps> = ({
  captains,
  selectedCity,
  role,
  onOpenKYCViewer,
  onToggleSuspend,
  onNavigateToSecondChance,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedCaptain, setSelectedCaptain] = useState<Captain | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [captainToSuspend, setCaptainToSuspend] = useState<Captain | null>(null);

  const filteredCaptains = captains.filter((c) => {
    if (selectedCity !== "All Cities" && c.city !== selectedCity) return false;
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.vehicle.plateNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Captain Fleet Operations
          </h1>
          <p className="text-xs text-slate-500">
            Monitor driver availability, vehicle compliance, ratings, and Second Chance status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToSecondChance}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-[#F94B35] hover:bg-rose-100 transition-colors shadow-xs"
          >
            <Heart className="h-4 w-4 fill-current" />
            Second Chance Program ({captains.filter((c) => c.secondChance.isEnrolled).length})
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {["ALL", "ACTIVE", "ON_TRIP", "PENDING_REVIEW", "SUSPENDED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search captain, phone, plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Captains Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCaptains.map((cap) => {
          const isSuspended = cap.status === "SUSPENDED";
          return (
            <div
              key={cap.id}
              className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Top Details */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={cap.avatar}
                      alt={cap.name}
                      className="h-12 w-12 rounded-full object-cover border-2 border-[#7A2B66]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {cap.name}
                        </h3>
                        {cap.secondChance.isEnrolled && (
                          <span title="Second Chance Enrolled">
                            <Heart className="h-3.5 w-3.5 text-[#F94B35] fill-current" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{cap.phone}</p>
                      <span className="text-[11px] text-amber-500 font-bold">
                        ★ {cap.rating > 0 ? cap.rating : "New"} ({cap.totalTrips} trips)
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      cap.status === "ACTIVE"
                        ? "teal"
                        : cap.status === "ON_TRIP"
                        ? "plum"
                        : cap.status === "PENDING_REVIEW"
                        ? "warning"
                        : "coral"
                    }
                    size="sm"
                    dot
                  >
                    {cap.status.replace("_", " ")}
                  </Badge>
                </div>

                {/* Vehicle Pill */}
                <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2.5 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white">
                        {cap.vehicle.make} {cap.vehicle.model}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {cap.vehicle.plateNumber} • {cap.vehicle.color}
                      </p>
                    </div>
                  </div>
                  {cap.vehicle.isElectric && (
                    <Badge variant="teal" size="sm">
                      ⚡ EV
                    </Badge>
                  )}
                </div>

                {/* Metric Strip */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                    <span className="text-[10px] text-slate-400">Acceptance</span>
                    <p className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                      {cap.acceptanceRate}%
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                    <span className="text-[10px] text-slate-400">Cancellation</span>
                    <p className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {cap.cancellationRate}%
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                    <span className="text-[10px] text-slate-400">Earned</span>
                    <p className="font-mono font-bold text-[#189578]">
                      ${cap.todayEarnings.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#331A3B] flex items-center justify-between gap-2">
                <button
                  onClick={() => onOpenKYCViewer(cap)}
                  className="rounded-xl border border-slate-200 dark:border-[#331A3B] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-colors flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Documents ({cap.documents.length})
                </button>

                <Can role={role} permission="captains.suspend">
                  <button
                    onClick={() => {
                      setCaptainToSuspend(cap);
                      setShowSuspendDialog(true);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      isSuspended
                        ? "bg-[#EFFCF9] text-[#189578] hover:bg-[#B4F2E1]"
                        : "bg-[#FFF3F1] text-[#F94B35] hover:bg-[#F94B35] hover:text-white"
                    }`}
                  >
                    {isSuspended ? "Reactivate" : "Suspend Driver"}
                  </button>
                </Can>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suspend Confirmation Dialog with Mandatory Reason */}
      {captainToSuspend && (
        <ConfirmDialog
          isOpen={showSuspendDialog}
          title={
            captainToSuspend.status === "SUSPENDED"
              ? "Reactivate Captain Account"
              : "Suspend Captain Credentials"
          }
          description={
            captainToSuspend.status === "SUSPENDED"
              ? `Reactivating ${captainToSuspend.name} will restore dispatch availability.`
              : `Suspending ${captainToSuspend.name} will immediately cancel active dispatch contracts and prevent driver app login.`
          }
          targetEntityLabel={captainToSuspend.name}
          confirmText={
            captainToSuspend.status === "SUSPENDED" ? "Confirm Reactivation" : "Confirm Suspension"
          }
          isDestructive={captainToSuspend.status !== "SUSPENDED"}
          requireReason={true}
          reasonPlaceholder="Specify reason (e.g. Speed telemetry violation, customer complaint investigation, document lapse)..."
          onConfirm={(reason) => {
            setShowSuspendDialog(false);
            onToggleSuspend(captainToSuspend.id, reason);
            setCaptainToSuspend(null);
          }}
          onCancel={() => {
            setShowSuspendDialog(false);
            setCaptainToSuspend(null);
          }}
        />
      )}
    </div>
  );
};
