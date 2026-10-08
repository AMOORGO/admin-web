"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  Wallet,
  ShieldAlert,
  Phone,
  Mail,
  Calendar,
  Eye,
  Sliders,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { Rider, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface PassengersViewProps {
  riders: Rider[];
  selectedCity: string;
  role: StaffRole;
  onToggleSuspend: (riderId: string, reason: string) => void;
  onAddWalletCredit?: (riderId: string, amount: number, note: string) => void;
}

export const PassengersView: React.FC<PassengersViewProps> = ({
  riders,
  selectedCity,
  role,
  onToggleSuspend,
  onAddWalletCredit,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [riderToSuspend, setRiderToSuspend] = useState<Rider | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState(15);
  const [creditNote, setCreditNote] = useState("");

  const filteredRiders = riders.filter((r) => {
    if (selectedCity !== "All Cities" && r.city !== selectedCity) return false;
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.email.toLowerCase().includes(q)
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
            Passenger Directory & Accounts
          </h1>
          <p className="text-xs text-slate-500">
            Manage passenger accounts, wallet balances, safety contacts, and status suspensions
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {["ALL", "ACTIVE", "FLAGGED", "SUSPENDED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search passenger, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        <div className="data-table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Passenger</th>
                <th className="py-3.5 px-4">City</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Rating & Trips</th>
                <th className="py-3.5 px-4 text-right">Lifetime Spend</th>
                <th className="py-3.5 px-4 text-right">Wallet Balance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Interventions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {filteredRiders.map((rider) => (
                <tr
                  key={rider.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-[#28162E]/30 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={rider.avatar}
                        alt={rider.name}
                        className="h-8 w-8 rounded-full object-cover border border-[#7A2B66]"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {rider.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          ID: {rider.id}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                    {rider.city}
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {rider.phone}
                    </p>
                    <p className="text-[10px] text-slate-400">{rider.email}</p>
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-bold text-amber-500">★ {rider.rating}</span>
                    <p className="text-[10px] text-slate-400">{rider.totalRides} Completed Rides</p>
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ${rider.lifetimeSpend.toFixed(2)}
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-bold text-[#189578]">
                    ${rider.walletBalance.toFixed(2)}
                  </td>

                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        rider.status === "ACTIVE"
                          ? "teal"
                          : rider.status === "FLAGGED"
                          ? "coral"
                          : "danger"
                      }
                      size="sm"
                      dot
                    >
                      {rider.status}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedRider(rider);
                          setShowCreditModal(true);
                        }}
                        className="rounded-lg bg-[#EFFCF9] dark:bg-[#0D2620] text-[#14755F] dark:text-[#82E5CB] px-2.5 py-1 text-xs font-bold hover:opacity-80"
                        title="Add Goodwill Wallet Credit"
                      >
                        +$ Credit
                      </button>

                      <Can role={role} permission="users.suspend">
                        <button
                          onClick={() => {
                            setRiderToSuspend(rider);
                            setShowSuspendDialog(true);
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                            rider.status === "SUSPENDED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                          }`}
                        >
                          {rider.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                        </button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend Confirmation Dialog */}
      {riderToSuspend && (
        <ConfirmDialog
          isOpen={showSuspendDialog}
          title={
            riderToSuspend.status === "SUSPENDED"
              ? "Reactivate Passenger Account"
              : "Suspend Passenger Account"
          }
          description={
            riderToSuspend.status === "SUSPENDED"
              ? `Reactivating ${riderToSuspend.name} will allow them to book rides again.`
              : `Suspending ${riderToSuspend.name} will prevent new ride requests and freeze wallet withdrawals.`
          }
          targetEntityLabel={riderToSuspend.name}
          confirmText={
            riderToSuspend.status === "SUSPENDED" ? "Confirm Reactivation" : "Confirm Suspension"
          }
          isDestructive={riderToSuspend.status !== "SUSPENDED"}
          requireReason={true}
          reasonPlaceholder="Specify reason (e.g. Chargeback abuse, severe verbal harassment, safety incident investigation)..."
          onConfirm={(reason) => {
            setShowSuspendDialog(false);
            onToggleSuspend(riderToSuspend.id, reason);
            setRiderToSuspend(null);
          }}
          onCancel={() => {
            setShowSuspendDialog(false);
            setRiderToSuspend(null);
          }}
        />
      )}

      {/* Wallet Credit Modal */}
      {showCreditModal && selectedRider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Issue Goodwill Credit: {selectedRider.name}
            </h3>
            <p className="text-xs text-slate-500">
              Current Balance: ${selectedRider.walletBalance.toFixed(2)}. Credit will be applied instantly.
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Credit Amount ($)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white"
              />
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Operational Reason
              </label>
              <textarea
                rows={2}
                placeholder="Reason for goodwill credit (e.g. Delayed pickup courtesy voucher)..."
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreditModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!creditNote || creditAmount <= 0}
                onClick={() => {
                  if (onAddWalletCredit) {
                    onAddWalletCredit(selectedRider.id, creditAmount, creditNote);
                  }
                  setShowCreditModal(false);
                }}
                className="rounded-xl bg-[#189578] text-white px-4 py-2 text-xs font-bold hover:bg-[#14755F] disabled:opacity-40"
              >
                Credit ${creditAmount.toFixed(2)} to Wallet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
