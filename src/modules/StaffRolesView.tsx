"use client";

import React, { useState } from "react";
import {
  UserCog,
  Shield,
  UserPlus,
  KeyRound,
  Lock,
  Mail,
  Check,
  X,
  Sliders,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { StaffUser, StaffRole, PermissionKey } from "@/types";
import { ROLE_PERMISSIONS } from "@/utils/permissions";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface StaffRolesViewProps {
  staffList: StaffUser[];
  role: StaffRole;
  onInviteStaff: (newStaff: { name: string; email: string; role: StaffRole; cityScope: string[] }) => void;
  onToggleStaffStatus: (staffId: string, reason: string) => void;
  onReset2FA: (staffId: string, reason: string) => void;
}

export const StaffRolesView: React.FC<StaffRolesViewProps> = ({
  staffList,
  role,
  onInviteStaff,
  onToggleStaffStatus,
  onReset2FA,
}) => {
  const [activeTab, setActiveTab] = useState<"STAFF" | "MATRIX">("STAFF");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("OPERATIONS_ADMIN");
  const [inviteCity, setInviteCity] = useState("ALL");

  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showReset2FADialog, setShowReset2FADialog] = useState(false);

  // All permission keys to display in matrix
  const permissionKeys: { key: PermissionKey; category: string; label: string }[] = [
    { key: "dashboard.view", category: "Operations", label: "View Executive Dashboard" },
    { key: "rides.view", category: "Operations", label: "View Rides & Live Map" },
    { key: "rides.reassign", category: "Interventions", label: "Manual Driver Reassignment" },
    { key: "rides.cancel", category: "Interventions", label: "Cancel Rides (Emergency)" },
    { key: "rides.adjust_fare", category: "Interventions", label: "Adjust Ride Fare" },
    { key: "captains.view", category: "Fleet", label: "View Captain Profiles" },
    { key: "captains.approve", category: "Fleet", label: "Approve / Reject KYC Applications" },
    { key: "captains.suspend", category: "Fleet", label: "Suspend Driver Credentials" },
    { key: "second_chance.manage", category: "Second Chance", label: "Manage Second Chance Drivers" },
    { key: "users.view", category: "Passengers", label: "View Passenger Accounts" },
    { key: "users.suspend", category: "Passengers", label: "Suspend Passenger Accounts" },
    { key: "safety.manage", category: "Safety", label: "Respond to SOS Emergencies" },
    { key: "finance.view", category: "Finance", label: "View Ledger & Transactions" },
    { key: "finance.refund", category: "Finance", label: "Authorize Passenger Refunds" },
    { key: "finance.payouts", category: "Finance", label: "Release Captain ACH Payout Batches" },
    { key: "config.view", category: "Configuration", label: "View City Pricing & Geofences" },
    { key: "config.edit", category: "Configuration", label: "Modify Base Fares & Surge Caps" },
    { key: "staff.manage", category: "IAM", label: "Invite & Manage Staff Co-Admins" },
    { key: "audit.view", category: "Compliance", label: "Inspect Immutable Audit Trail" },
  ];

  const rolesList: StaffRole[] = [
    "SUPER_ADMIN",
    "OPERATIONS_ADMIN",
    "CAPTAIN_OPS",
    "FINANCE_ADMIN",
    "SUPPORT_AGENT",
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Staff Management & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500">
            Invite co-admins, configure regional scopes, enforce TOTP 2FA, and inspect granular permission matrix
          </p>
        </div>

        <Can role={role} permission="staff.manage">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#3A102F] hover:bg-[#521A44] dark:bg-[#7A2B66] text-white px-4 py-2 text-xs font-bold transition-all shadow-md"
          >
            <UserPlus className="h-4 w-4" />
            Invite Co-Admin
          </button>
        </Can>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#F0E3ED] dark:border-[#331A3B] gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab("STAFF")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "STAFF"
              ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          Staff & Co-Admins ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab("MATRIX")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "MATRIX"
              ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          Granular Permission Matrix (PRD §113)
        </button>
      </div>

      {/* Tab 1: Staff List */}
      {activeTab === "STAFF" && (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Regional Scope</th>
                <th className="py-3 px-4">2FA Status</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {staffList.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={st.avatar}
                        alt={st.name}
                        className="h-8 w-8 rounded-full object-cover border border-[#7A2B66]"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{st.name}</p>
                        <p className="text-[10px] text-slate-400">{st.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <Badge variant="plum" size="sm">
                      {st.role.replace("_", " ")}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {st.cityScope.join(", ")}
                  </td>

                  <td className="py-3 px-4">
                    {st.is2FAEnabled ? (
                      <Badge variant="teal" size="sm" dot>
                        TOTP Active
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        Not Enforced
                      </Badge>
                    )}
                  </td>

                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {st.lastLogin}
                  </td>

                  <td className="py-3 px-4">
                    <Badge
                      variant={st.status === "ACTIVE" ? "teal" : "coral"}
                      size="sm"
                    >
                      {st.status}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <Can role={role} permission="staff.manage">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedStaff(st);
                            setShowReset2FADialog(true);
                          }}
                          className="rounded-lg bg-slate-100 dark:bg-[#211226] text-slate-700 dark:text-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-200"
                          title="Reset 2FA Secret"
                        >
                          Reset 2FA
                        </button>

                        {st.role !== "SUPER_ADMIN" && (
                          <button
                            onClick={() => {
                              setSelectedStaff(st);
                              setShowSuspendDialog(true);
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                              st.status === "ACTIVE"
                                ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {st.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                          </button>
                        )}
                      </div>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: RBAC Matrix */}
      {activeTab === "MATRIX" && (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/40 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Role Permission Capabilities (Matches Blueprint Section 8 & PRD §113)
            </span>
            <span className="text-slate-400 italic">
              Checked permissions are active for the role
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-72">Permission Key</th>
                  {rolesList.map((r) => (
                    <th key={r} className="py-3 px-4 text-center">
                      {r.replace("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {permissionKeys.map((p) => (
                  <tr key={p.key} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {p.label}
                      </span>
                      <p className="font-mono text-[10px] text-slate-400">{p.key}</p>
                    </td>

                    {rolesList.map((r) => {
                      const isAllowed = ROLE_PERMISSIONS[r]?.includes(p.key);
                      return (
                        <td key={r} className="py-3 px-4 text-center">
                          {isAllowed ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-[#211226]">
                              <X className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Co-Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Invite Co-Administrator
            </h3>
            <p className="text-xs text-slate-500">
              An activation invitation with temporary credentials and mandatory 2FA enrollment will be sent.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jordan Lee"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Work Email
                </label>
                <input
                  type="email"
                  placeholder="jordan.lee@amoorgo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Administrative Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as StaffRole)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white cursor-pointer font-semibold"
                >
                  <option value="OPERATIONS_ADMIN">Operations Admin</option>
                  <option value="CAPTAIN_OPS">Captain Ops</option>
                  <option value="FINANCE_ADMIN">Finance Admin</option>
                  <option value="SUPPORT_AGENT">Support Agent</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  City Scope Restriction
                </label>
                <select
                  value={inviteCity}
                  onChange={(e) => setInviteCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white cursor-pointer"
                >
                  <option value="ALL">All Cities (Global)</option>
                  <option value="Austin">Austin, TX only</option>
                  <option value="Dallas">Dallas, TX only</option>
                  <option value="Houston">Houston, TX only</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!inviteName || !inviteEmail}
                onClick={() => {
                  onInviteStaff({
                    name: inviteName,
                    email: inviteEmail,
                    role: inviteRole,
                    cityScope: [inviteCity],
                  });
                  setShowInviteModal(false);
                  setInviteName("");
                  setInviteEmail("");
                }}
                className="rounded-xl bg-[#3A102F] text-white px-4 py-2 text-xs font-bold hover:bg-[#521A44] disabled:opacity-40"
              >
                Send Staff Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Dialog */}
      {selectedStaff && (
        <ConfirmDialog
          isOpen={showSuspendDialog}
          title={
            selectedStaff.status === "ACTIVE"
              ? "Suspend Staff Access"
              : "Reactivate Staff Account"
          }
          description={
            selectedStaff.status === "ACTIVE"
              ? `Suspending ${selectedStaff.name} will immediately invalidate active session tokens and block admin panel login.`
              : `Reactivating ${selectedStaff.name} will restore staff access.`
          }
          targetEntityLabel={selectedStaff.name}
          confirmText={
            selectedStaff.status === "ACTIVE" ? "Confirm Suspension" : "Confirm Reactivation"
          }
          isDestructive={selectedStaff.status === "ACTIVE"}
          requireReason={true}
          reasonPlaceholder="Specify administrative reason..."
          onConfirm={(reason) => {
            setShowSuspendDialog(false);
            onToggleStaffStatus(selectedStaff.id, reason);
            setSelectedStaff(null);
          }}
          onCancel={() => {
            setShowSuspendDialog(false);
            setSelectedStaff(null);
          }}
        />
      )}

      {/* Reset 2FA Confirmation Dialog */}
      {selectedStaff && (
        <ConfirmDialog
          isOpen={showReset2FADialog}
          title="Reset Two-Factor Authentication"
          description={`Resetting 2FA for ${selectedStaff.name} will require them to scan a new TOTP QR code upon next login.`}
          targetEntityLabel={selectedStaff.name}
          confirmText="Reset 2FA Secret"
          isDestructive={false}
          requireReason={true}
          reasonPlaceholder="Specify reason (e.g. Lost device verified via security interview)..."
          onConfirm={(reason) => {
            setShowReset2FADialog(false);
            onReset2FA(selectedStaff.id, reason);
            setSelectedStaff(null);
          }}
          onCancel={() => {
            setShowReset2FADialog(false);
            setSelectedStaff(null);
          }}
        />
      )}
    </div>
  );
};
