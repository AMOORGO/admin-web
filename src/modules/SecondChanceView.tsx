"use client";

import React, { useState } from "react";
import {
  Heart,
  ShieldCheck,
  Award,
  AlertTriangle,
  Sliders,
  CheckCircle,
  Clock,
  Gauge,
  UserCheck,
  PlusCircle,
  FileText,
  Search,
} from "lucide-react";
import { Captain, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface SecondChanceViewProps {
  captains: Captain[];
  selectedCity: string;
  role: StaffRole;
  onUpdateConditions: (
    captainId: string,
    conditions: { maxDailyHours: number; speedGovernor: boolean; restrictedNight: boolean }
  ) => void;
  onPromoteTier: (captainId: string, newTier: string) => void;
  onRevokeSecondChance: (captainId: string, reason: string) => void;
}

export const SecondChanceView: React.FC<SecondChanceViewProps> = ({
  captains,
  selectedCity,
  role,
  onUpdateConditions,
  onPromoteTier,
  onRevokeSecondChance,
}) => {
  const [selectedDriver, setSelectedDriver] = useState<Captain | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editHours, setEditHours] = useState(7);
  const [editGovernor, setEditGovernor] = useState(true);
  const [editNight, setEditNight] = useState(true);

  const secondChanceDrivers = captains.filter((c) => c.secondChance.isEnrolled);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Brand Header Banner */}
      <div className="rounded-3xl border border-[#FFC4BC] dark:border-[#61130A] bg-gradient-to-r from-[#FFF3F1] via-white to-[#FAF0F7] dark:from-[#38110D]/40 dark:via-[#180D1C] dark:to-[#331A3B]/40 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F94B35] text-white">
                <Heart className="h-4 w-4 fill-current" />
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                Second Chance Driver Management
              </h1>
              <Badge variant="coral" size="sm">
                PRD Section 28
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              "Move in Love. Love is the frequency. Safety is the foundation." — Providing structured
              rehabilitation, speed telemetry monitoring, and mentored opportunities for qualified drivers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#FFC4BC] dark:border-[#61130A] bg-white dark:bg-[#180D1C] px-4 py-2 text-right shadow-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Program Drivers</span>
              <p className="text-lg font-black text-[#F94B35]">
                {secondChanceDrivers.length} Enrolled
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-[#180D1C] px-4 py-2 text-right shadow-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Avg Compliance</span>
              <p className="text-lg font-black text-emerald-600">98.8%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Profiles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {secondChanceDrivers.map((driver) => {
          const sc = driver.secondChance;
          const progressPercent = Math.min(
            100,
            Math.round((sc.probationRidesCompleted / sc.probationRidesTarget) * 100)
          );

          return (
            <div
              key={driver.id}
              className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4 hover:shadow-md transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={driver.avatar}
                    alt={driver.name}
                    className="h-12 w-12 rounded-2xl object-cover border-2 border-[#F94B35]"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {driver.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {driver.phone} • {driver.city}
                    </p>
                    <span className="text-[11px] font-bold text-amber-500">
                      ★ {driver.rating} ({driver.totalTrips} Total Trips)
                    </span>
                  </div>
                </div>

                <Badge variant={sc.tier === "TIER_1_PROBATION" ? "coral" : "plum"} size="sm">
                  {sc.tier.replace(/_/g, " ")}
                </Badge>
              </div>

              {/* Probation Progress Bar */}
              <div className="space-y-1.5 rounded-xl border border-slate-100 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-3">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Probation Milestones ({sc.probationRidesCompleted} / {sc.probationRidesTarget} rides)
                  </span>
                  <span className="font-mono font-bold text-[#F94B35]">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F94B35] to-[#7A2B66]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Target: Complete {sc.probationRidesTarget} verified rides with zero critical infractions.
                </p>
              </div>

              {/* Conditions & Safety Controls Checklist */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                    <Gauge className="h-3.5 w-3.5 text-[#F94B35]" />
                    Governor
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white mt-1">
                    {sc.speedGovernorEnabled ? "ACTIVE (65mph)" : "Standard"}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                    <Clock className="h-3.5 w-3.5 text-[#7A2B66]" />
                    Max Shift
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white mt-1">
                    {sc.maxDailyHours} Hours / Day
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Mentor Staff
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white mt-1 truncate">
                    {sc.sponsorMentor || "Operations"}
                  </p>
                </div>
              </div>

              {/* Admin Clinical Notes */}
              <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] p-3 text-xs bg-slate-50/50 dark:bg-[#211226]/40 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Administrative Review Notes
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  {sc.eligibilityNotes}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#331A3B] flex items-center justify-between gap-2">
                <Can role={role} permission="second_chance.manage">
                  <button
                    onClick={() => {
                      setSelectedDriver(driver);
                      setEditHours(sc.maxDailyHours);
                      setEditGovernor(sc.speedGovernorEnabled);
                      setEditNight(sc.restrictedNightDriving);
                      setShowEditModal(true);
                    }}
                    className="rounded-xl border border-slate-200 dark:border-[#331A3B] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-all flex items-center gap-1.5"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    Configure Conditions
                  </button>
                </Can>

                <div className="flex items-center gap-2">
                  <Can role={role} permission="second_chance.manage">
                    <button
                      onClick={() => onPromoteTier(driver.id, "TIER_2_RESTRICTED")}
                      className="rounded-xl bg-[#EFFCF9] border border-[#B4F2E1] text-[#14755F] dark:bg-[#0D2620] dark:text-[#82E5CB] px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-all flex items-center gap-1"
                    >
                      <Award className="h-3.5 w-3.5" />
                      Promote Tier
                    </button>
                  </Can>

                  <Can role={role} permission="second_chance.manage">
                    <button
                      onClick={() => {
                        setSelectedDriver(driver);
                        setShowRevokeDialog(true);
                      }}
                      className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 transition-all"
                    >
                      Revoke
                    </button>
                  </Can>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revoke Confirmation Dialog with Mandatory Reason */}
      {selectedDriver && (
        <ConfirmDialog
          isOpen={showRevokeDialog}
          title="Revoke Second Chance Eligibility"
          description={`Revoking Second Chance status for ${selectedDriver.name} will terminate their probationary privileges and restrict standard driver workflow access.`}
          targetEntityLabel={selectedDriver.name}
          confirmText="Revoke Second Chance Program"
          isDestructive={true}
          requireReason={true}
          reasonPlaceholder="Specify reason (e.g. Critical speed telemetry breach, policy violation, failure to meet probation milestones)..."
          onConfirm={(reason) => {
            setShowRevokeDialog(false);
            onRevokeSecondChance(selectedDriver.id, reason);
            setSelectedDriver(null);
          }}
          onCancel={() => {
            setShowRevokeDialog(false);
            setSelectedDriver(null);
          }}
        />
      )}

      {/* Edit Conditions Modal */}
      {showEditModal && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Configure Second Chance Conditions: {selectedDriver.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Max Daily Driving Hours ({editHours} hrs)
                </label>
                <input
                  type="range"
                  min="4"
                  max="12"
                  value={editHours}
                  onChange={(e) => setEditHours(parseInt(e.target.value))}
                  className="w-full accent-[#F94B35]"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-[#331A3B]">
                <span>Speed Governor Enforced (Max 65 mph)</span>
                <input
                  type="checkbox"
                  checked={editGovernor}
                  onChange={(e) => setEditGovernor(e.target.checked)}
                  className="h-4 w-4 accent-[#F94B35]"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-[#331A3B]">
                <span>Restricted Night Driving (11pm - 5am)</span>
                <input
                  type="checkbox"
                  checked={editNight}
                  onChange={(e) => setEditNight(e.target.checked)}
                  className="h-4 w-4 accent-[#F94B35]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateConditions(selectedDriver.id, {
                    maxDailyHours: editHours,
                    speedGovernor: editGovernor,
                    restrictedNight: editNight,
                  });
                  setShowEditModal(false);
                }}
                className="rounded-xl bg-[#F94B35] hover:bg-[#D93320] text-white px-4 py-2 text-xs font-bold shadow-md"
              >
                Save Conditions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
