"use client";

import React, { useState } from "react";
import {
  X,
  MapPin,
  Clock,
  ShieldAlert,
  User,
  Car,
  DollarSign,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Ban,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { Ride, StaffRole } from "@/types";
import { Badge } from "./Badge";
import { Can } from "./Can";
import { ConfirmDialog } from "./ConfirmDialog";

interface RideDrawerProps {
  ride: Ride | null;
  role: StaffRole;
  onClose: () => void;
  onCancelRide?: (rideId: string, reason: string) => void;
  onReassignDriver?: (rideId: string, reason: string) => void;
  onAdjustFare?: (rideId: string, amount: number, reason: string) => void;
}

export const RideDrawer: React.FC<RideDrawerProps> = ({
  ride,
  role,
  onClose,
  onCancelRide,
  onReassignDriver,
  onAdjustFare,
}) => {
  const [activeTab, setActiveTab] = useState<"TIMELINE" | "FARE" | "DISPATCH">("TIMELINE");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [showAdjustFareModal, setShowAdjustFareModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");

  if (!ride) return null;

  const statusVariantMap: Record<string, "plum" | "teal" | "coral" | "neutral" | "warning"> = {
    ON_TRIP: "plum",
    ARRIVING: "teal",
    SEARCHING: "warning",
    ACCEPTED: "teal",
    COMPLETED: "teal",
    CANCELLED: "coral",
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
        <div
          className="relative w-full max-w-xl h-full bg-white dark:bg-[#180D1C] border-l border-[#F0E3ED] dark:border-[#331A3B] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
          role="dialog"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4 bg-[#FAF0F7]/40 dark:bg-[#211226]/50">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {ride.bookingCode}
                  </h3>
                  <Badge variant={statusVariantMap[ride.status] || "neutral"} size="sm" dot>
                    {ride.status.replace("_", " ")}
                  </Badge>
                  {ride.hasSOSAlert && (
                    <Badge variant="coral" size="sm" pulse>
                      🚨 SOS ACTIVE
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {ride.city} • {ride.serviceType.replace("_", " ")} • ID: {ride.id}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#28162E] dark:hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-[#F0E3ED] dark:border-[#331A3B] px-6 bg-white dark:bg-[#180D1C]">
            <button
              onClick={() => setActiveTab("TIMELINE")}
              className={`py-3 text-xs font-bold border-b-2 mr-6 transition-all ${
                activeTab === "TIMELINE"
                  ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              Ride State Timeline
            </button>
            <button
              onClick={() => setActiveTab("FARE")}
              className={`py-3 text-xs font-bold border-b-2 mr-6 transition-all ${
                activeTab === "FARE"
                  ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              Fare Breakdown (${ride.fare.grossFare.toFixed(2)})
            </button>
            <button
              onClick={() => setActiveTab("DISPATCH")}
              className={`py-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === "DISPATCH"
                  ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              Dispatch Log ({ride.dispatchAttempts.length})
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Route Summary Card */}
            <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-1">
                  <div className="h-3 w-3 rounded-full bg-[#3A102F] dark:bg-[#A74490]" />
                  <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-700 my-0.5" />
                  <div className="h-3 w-3 rounded-full bg-[#189578]" />
                </div>
                <div className="flex-1 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">PICKUP</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {ride.pickupAddress}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">DROPOFF</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {ride.dropoffAddress}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400">PIN CODE</span>
                  <p className="text-base font-mono font-black text-[#7A2B66] dark:text-[#DB99CC]">
                    {ride.otpPin}
                  </p>
                </div>
              </div>
            </div>

            {/* Rider & Captain Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Rider */}
              <div className="rounded-xl border border-[#F0E3ED] dark:border-[#331A3B] p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    PASSENGER
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={ride.rider.avatar}
                    alt={ride.rider.name}
                    className="h-10 w-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {ride.rider.name}
                    </p>
                    <p className="text-[11px] text-slate-500">{ride.rider.phone}</p>
                    <span className="text-[11px] font-bold text-amber-500">
                      ★ {ride.rider.rating}
                    </span>
                  </div>
                </div>
              </div>

              {/* Captain */}
              <div className="rounded-xl border border-[#F0E3ED] dark:border-[#331A3B] p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-[#189578]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    CAPTAIN
                  </span>
                </div>
                {ride.captain ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={ride.captain.avatar}
                      alt={ride.captain.name}
                      className="h-10 w-10 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {ride.captain.name}
                      </p>
                      <p className="text-[11px] font-mono text-[#7A2B66] dark:text-[#DB99CC] font-bold">
                        {ride.captain.vehiclePlate} • {ride.captain.vehicleModel}
                      </p>
                      <span className="text-[11px] font-bold text-amber-500">
                        ★ {ride.captain.rating}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-xs text-slate-400 italic">
                    No captain assigned yet
                  </div>
                )}
              </div>
            </div>

            {/* Tab 1: Finite State Machine Timeline */}
            {activeTab === "TIMELINE" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Finite State Machine Progression
                </h4>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-[#331A3B]">
                  {ride.timeline.map((step, index) => (
                    <div key={index} className="relative">
                      <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-[#180D1C] border-2 border-[#7A2B66]">
                        <div className="h-2 w-2 rounded-full bg-[#7A2B66]" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {step.title}
                          </p>
                          <span className="text-[11px] font-mono text-slate-400">
                            {step.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {step.description}
                        </p>
                        {step.latencySeconds && (
                          <span className="inline-block mt-1 text-[10px] font-mono font-semibold text-[#189578] bg-[#EFFCF9] dark:bg-[#0D2620] px-2 py-0.5 rounded">
                            Latency: {step.latencySeconds}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 2: Fare Breakdown */}
            {activeTab === "FARE" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#F0E3ED] dark:border-[#331A3B] overflow-hidden">
                  <div className="bg-[#FAF0F7]/50 dark:bg-[#211226]/50 px-4 py-3 border-b border-[#F0E3ED] dark:border-[#331A3B] flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pricing Component
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Amount ($)
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-[#331A3B] text-xs">
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600 dark:text-slate-400">Base Fare</span>
                      <span className="font-mono font-semibold">${ride.fare.baseFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600 dark:text-slate-400">
                        Distance ({ride.fare.distanceKm} mi @ $1.25/mi)
                      </span>
                      <span className="font-mono font-semibold">${ride.fare.distanceFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600 dark:text-slate-400">
                        Duration ({ride.fare.durationMinutes} mins @ $0.30/min)
                      </span>
                      <span className="font-mono font-semibold">${ride.fare.timeFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 bg-amber-50/50 dark:bg-amber-950/20">
                      <span className="text-amber-800 dark:text-amber-300 font-semibold">
                        Surge Multiplier ({ride.fare.surgeMultiplier}x)
                      </span>
                      <span className="font-mono font-bold text-amber-600">
                        +${ride.fare.surgeFare.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600 dark:text-slate-400">Airport Surcharge / Toll</span>
                      <span className="font-mono font-semibold">${ride.fare.tollAndWait.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600 dark:text-slate-400">State / Local Taxes</span>
                      <span className="font-mono font-semibold">${ride.fare.taxes.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 bg-[#FAF0F7] dark:bg-[#331A3B] font-bold">
                      <span className="text-[#3A102F] dark:text-[#E9BFDF]">Gross Rider Charge</span>
                      <span className="font-mono text-sm text-[#3A102F] dark:text-[#E9BFDF]">
                        ${ride.fare.grossFare.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 text-[#14755F] dark:text-[#82E5CB]">
                      <span>Platform Commission (15%)</span>
                      <span className="font-mono font-bold">-${ride.fare.platformCommission.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold">
                      <span>Captain Net Payout</span>
                      <span className="font-mono text-sm">
                        ${ride.fare.captainNetPayout.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>Payment Gateway: {ride.paymentMethod}</span>
                  <Badge variant={ride.paymentStatus === "CAPTURED" ? "teal" : "warning"} size="sm">
                    {ride.paymentStatus}
                  </Badge>
                </div>
              </div>
            )}

            {/* Tab 3: Dispatch Candidate Log */}
            {activeTab === "DISPATCH" && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Radar Dispatch Attempts
                </h4>
                {ride.dispatchAttempts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No dispatch attempts recorded.</p>
                ) : (
                  ride.dispatchAttempts.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 dark:border-[#331A3B] p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {d.captainName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {d.distanceKm} km away • Offered at {d.offeredAt}
                        </p>
                        {d.reason && (
                          <p className="text-[10px] text-rose-500 font-medium mt-0.5">
                            Reason: {d.reason}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          d.response === "ACCEPTED"
                            ? "teal"
                            : d.response === "TIMEOUT"
                            ? "warning"
                            : "coral"
                        }
                        size="sm"
                      >
                        {d.response}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Admin Intervention Controls Footer */}
          <div className="border-t border-[#F0E3ED] dark:border-[#331A3B] p-4 bg-[#FAF0F7]/40 dark:bg-[#211226]/50 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              OPERATIONAL INTERVENTIONS
            </span>
            <div className="grid grid-cols-3 gap-2">
              {/* Reassign Driver */}
              <Can role={role} permission="rides.reassign">
                <button
                  onClick={() => setShowReassignDialog(true)}
                  disabled={ride.status === "COMPLETED" || ride.status === "CANCELLED"}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#7A2B66] hover:text-[#7A2B66] disabled:opacity-40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reassign
                </button>
              </Can>

              {/* Adjust Fare */}
              <Can role={role} permission="rides.adjust_fare">
                <button
                  onClick={() => setShowAdjustFareModal(true)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#189578] hover:text-[#189578] transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Adjust Fare
                </button>
              </Can>

              {/* Cancel Ride */}
              <Can role={role} permission="rides.cancel">
                <button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={ride.status === "COMPLETED" || ride.status === "CANCELLED"}
                  className="rounded-xl bg-[#FFF3F1] dark:bg-[#38110D] border border-[#FFC4BC] dark:border-[#61130A] p-2 text-xs font-bold text-[#F94B35] hover:bg-[#F94B35] hover:text-white disabled:opacity-40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancel Ride
                </button>
              </Can>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog with Mandatory Reason */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Emergency Cancellation of Ride"
        description="Cancelling this ride will immediately terminate the passenger booking and broadcast a state change to the captain and payment gateway."
        targetEntityLabel={ride.bookingCode}
        confirmText="Confirm Cancellation"
        isDestructive={true}
        requireReason={true}
        reasonPlaceholder="Specify reason (e.g. Passenger safety concern, driver vehicle malfunction, operator override)..."
        onConfirm={(reason) => {
          setShowCancelDialog(false);
          if (onCancelRide) onCancelRide(ride.id, reason);
        }}
        onCancel={() => setShowCancelDialog(false)}
      />

      {/* Reassign Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showReassignDialog}
        title="Manual Driver Reassignment"
        description="The current captain will be released from the dispatch contract and the ride state will transition to SEARCHING for immediate priority re-dispatch."
        targetEntityLabel={ride.bookingCode}
        confirmText="Confirm Reassignment"
        isDestructive={false}
        requireReason={true}
        reasonPlaceholder="Reason for manual reassignment..."
        onConfirm={(reason) => {
          setShowReassignDialog(false);
          if (onReassignDriver) onReassignDriver(ride.id, reason);
        }}
        onCancel={() => setShowReassignDialog(false)}
      />

      {/* Adjust Fare Modal */}
      {showAdjustFareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Adjust Ride Fare ({ride.bookingCode})
              </h3>
              <button
                onClick={() => setShowAdjustFareModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Adjustment Amount ($) (Negative for discount/refund, positive for surcharge)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="-5.00"
                value={adjustAmount || ""}
                onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white"
              />
            </div>
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Mandatory Operational Justification
              </label>
              <textarea
                rows={2}
                placeholder="Operational justification for fare adjustment..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAdjustFareModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!adjustReason || adjustAmount === 0}
                onClick={() => {
                  if (onAdjustFare) onAdjustFare(ride.id, adjustAmount, adjustReason);
                  setShowAdjustFareModal(false);
                }}
                className="rounded-xl bg-[#3A102F] text-white px-4 py-2 text-xs font-bold hover:bg-[#521A44] disabled:opacity-40"
              >
                Apply Fare Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
