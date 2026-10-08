"use client";

import React, { useState } from "react";
import {
  Wallet,
  DollarSign,
  TrendingUp,
  CreditCard,
  RotateCcw,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Transaction, PayoutBatch, RefundRequest, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface FinanceViewProps {
  transactions: Transaction[];
  payoutBatches: PayoutBatch[];
  refundRequests: RefundRequest[];
  role: StaffRole;
  onApproveRefund: (refundId: string, reason: string) => void;
  onRejectRefund: (refundId: string, reason: string) => void;
  onTriggerPayoutBatch: (batchId: string, reason: string) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  transactions,
  payoutBatches,
  refundRequests,
  role,
  onApproveRefund,
  onRejectRefund,
  onTriggerPayoutBatch,
}) => {
  const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "PAYOUTS" | "REFUNDS">("TRANSACTIONS");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [showRefundApproveDialog, setShowRefundApproveDialog] = useState(false);
  const [showRefundRejectDialog, setShowRefundRejectDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PayoutBatch | null>(null);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Finance, Ledger & Settlements
          </h1>
          <p className="text-xs text-slate-500">
            Double-entry ledger integrity, gateway transactions, captain payout batches, and refund disputes
          </p>
        </div>
      </div>

      {/* Financial Health Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 space-y-1 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Gross Bookings (GMV)
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">$118,920.00</p>
          <span className="text-[11px] font-medium text-emerald-600">+12.5% MTD</span>
        </div>

        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 space-y-1 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Platform Net Take (15%)
          </span>
          <p className="text-2xl font-black text-[#7A2B66] dark:text-[#DB99CC]">$17,838.00</p>
          <span className="text-[11px] font-medium text-slate-500">Automated ledger cut</span>
        </div>

        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 space-y-1 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Captain Payable Pool
          </span>
          <p className="text-2xl font-black text-[#189578]">$101,082.00</p>
          <span className="text-[11px] font-medium text-slate-500">Settlements scheduled</span>
        </div>

        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 space-y-1 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Refund Disputes
          </span>
          <p className="text-2xl font-black text-[#F94B35]">
            {refundRequests.filter((r) => r.status === "PENDING").length} Pending
          </p>
          <span className="text-[11px] font-medium text-slate-500">Average SLA: 2.1 hrs</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#F0E3ED] dark:border-[#331A3B] gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab("TRANSACTIONS")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "TRANSACTIONS"
              ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          Payment Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab("PAYOUTS")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "PAYOUTS"
              ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          Captain Payout Batches ({payoutBatches.length})
        </button>
        <button
          onClick={() => setActiveTab("REFUNDS")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "REFUNDS"
              ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          Refund Requests ({refundRequests.length})
        </button>
      </div>

      {/* Tab 1: Transactions Table */}
      {activeTab === "TRANSACTIONS" && (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Txn ID</th>
                <th className="py-3 px-4">Ride Ref</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Customer / Captain</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Platform Cut</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {tx.id}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#7A2B66] dark:text-[#DB99CC]">
                    {tx.rideId}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="plum" size="sm">
                      {tx.gateway}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                    {tx.type}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {tx.customerName}
                    </span>
                    <p className="text-[10px] text-slate-400">to {tx.captainName}</p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ${tx.amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#189578] font-semibold">
                    ${tx.platformFee.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant={
                        tx.status === "SUCCESS"
                          ? "teal"
                          : tx.status === "PENDING"
                          ? "warning"
                          : "coral"
                      }
                      size="sm"
                    >
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {tx.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Payout Batches */}
      {activeTab === "PAYOUTS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {payoutBatches.map((batch) => (
              <div
                key={batch.id}
                className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {batch.batchNumber}
                    </h3>
                    <p className="text-xs text-slate-500">City: {batch.city} • Auto Settlement</p>
                  </div>
                  <Badge
                    variant={batch.status === "COMPLETED" ? "teal" : "warning"}
                    size="sm"
                  >
                    {batch.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#211226]">
                    <span className="text-[10px] text-slate-400 uppercase">Captains</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {batch.totalCaptains}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#211226]">
                    <span className="text-[10px] text-slate-400 uppercase">Gross Payable</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      ${batch.totalGrossPayable.toFixed(0)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#EFFCF9] dark:bg-[#0D2620]">
                    <span className="text-[10px] text-slate-400 uppercase">Net Settlement</span>
                    <p className="font-mono font-bold text-[#14755F] dark:text-[#82E5CB] mt-0.5">
                      ${batch.netPayoutAmount.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-[#331A3B] flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Generated: {batch.generatedAt.split("T")[0]}
                  </span>
                  {batch.status === "PROCESSING" && (
                    <Can role={role} permission="finance.payouts">
                      <button
                        onClick={() => {
                          setSelectedBatch(batch);
                          setShowPayoutDialog(true);
                        }}
                        className="rounded-xl bg-[#3A102F] text-white px-4 py-1.5 text-xs font-bold hover:bg-[#521A44] transition-all"
                      >
                        Authorize & Release ACH Batch
                      </button>
                    </Can>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Refunds Management */}
      {activeTab === "REFUNDS" && (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Refund ID</th>
                <th className="py-3 px-4">Ride ID</th>
                <th className="py-3 px-4">Passenger</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Claim Reason</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {refundRequests.map((ref) => (
                <tr key={ref.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {ref.id}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#7A2B66] dark:text-[#DB99CC]">
                    {ref.rideId}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {ref.riderName}
                    </span>
                    <p className="text-[10px] text-slate-400">{ref.riderPhone}</p>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="plum" size="sm">
                      {ref.category.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs">
                    {ref.reason}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                    ${ref.amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant={
                        ref.status === "APPROVED"
                          ? "teal"
                          : ref.status === "PENDING"
                          ? "warning"
                          : "coral"
                      }
                      size="sm"
                    >
                      {ref.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {ref.status === "PENDING" ? (
                      <Can role={role} permission="finance.refund">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedRefund(ref);
                              setShowRefundApproveDialog(true);
                            }}
                            className="rounded-lg bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-bold hover:bg-emerald-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRefund(ref);
                              setShowRefundRejectDialog(true);
                            }}
                            className="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 text-xs font-bold hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        </div>
                      </Can>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">
                        {ref.reviewedBy || "Reviewed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Approve Refund Dialog */}
      {selectedRefund && (
        <ConfirmDialog
          isOpen={showRefundApproveDialog}
          title="Approve Customer Refund"
          description={`Issuing a refund of $${selectedRefund.amount.toFixed(
            2
          )} will credit ${selectedRefund.riderName}'s original payment method and generate double-entry ledger offset.`}
          targetEntityLabel={selectedRefund.id}
          confirmText="Approve & Execute Refund"
          isDestructive={false}
          requireReason={true}
          reasonPlaceholder="Specify justification for financial refund audit trail..."
          onConfirm={(reason) => {
            setShowRefundApproveDialog(false);
            onApproveRefund(selectedRefund.id, reason);
            setSelectedRefund(null);
          }}
          onCancel={() => {
            setShowRefundApproveDialog(false);
            setSelectedRefund(null);
          }}
        />
      )}

      {/* Confirm Reject Refund Dialog */}
      {selectedRefund && (
        <ConfirmDialog
          isOpen={showRefundRejectDialog}
          title="Reject Refund Claim"
          description={`Rejecting ${selectedRefund.riderName}'s refund claim will close the dispute.`}
          targetEntityLabel={selectedRefund.id}
          confirmText="Deny Refund Request"
          isDestructive={true}
          requireReason={true}
          reasonPlaceholder="Specify policy rejection grounds..."
          onConfirm={(reason) => {
            setShowRefundRejectDialog(false);
            onRejectRefund(selectedRefund.id, reason);
            setSelectedRefund(null);
          }}
          onCancel={() => {
            setShowRefundRejectDialog(false);
            setSelectedRefund(null);
          }}
        />
      )}

      {/* Confirm Payout Batch Release Dialog */}
      {selectedBatch && (
        <ConfirmDialog
          isOpen={showPayoutDialog}
          title="Authorize & Release ACH Settlement Batch"
          description={`You are authorizing the release of $${selectedBatch.netPayoutAmount.toFixed(
            2
          )} to ${selectedBatch.totalCaptains} captains in ${selectedBatch.city}. This will trigger banking webhooks.`}
          targetEntityLabel={selectedBatch.batchNumber}
          confirmText="Release Settlement Batch"
          isDestructive={false}
          requireReason={true}
          reasonPlaceholder="Treasury approval reference or audit note..."
          onConfirm={(reason) => {
            setShowPayoutDialog(false);
            onTriggerPayoutBatch(selectedBatch.id, reason);
            setSelectedBatch(null);
          }}
          onCancel={() => {
            setShowPayoutDialog(false);
            setSelectedBatch(null);
          }}
        />
      )}
    </div>
  );
};
