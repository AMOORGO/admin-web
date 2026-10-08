"use client";

import React, { useState, useEffect } from "react";
import {
  MOCK_STAFF_USERS,
  MOCK_RIDES,
  MOCK_CAPTAINS,
  MOCK_RIDERS,
  MOCK_SOS_INCIDENTS,
  MOCK_TRANSACTIONS,
  MOCK_PAYOUT_BATCHES,
  MOCK_REFUND_REQUESTS,
  MOCK_AUDIT_LOGS,
  MOCK_PRICING_CONFIGS,
  MOCK_GEOFENCES,
} from "@/data/mockData";
import {
  StaffUser,
  StaffRole,
  Ride,
  Captain,
  Rider,
  SOSIncident,
  Transaction,
  PayoutBatch,
  RefundRequest,
  AuditLogEntry,
  CityPricingConfig,
  GeofenceZone,
} from "@/types";
import { Navbar } from "@/components/Navbar";
import { Sidebar, AdminTab } from "@/components/Sidebar";
import { RideDrawer } from "@/components/RideDrawer";
import { KYCDocumentViewer } from "@/components/KYCDocumentViewer";
import { SOSCommandModal } from "@/components/SOSCommandModal";

import { DashboardView } from "@/modules/DashboardView";
import { LiveOpsView } from "@/modules/LiveOpsView";
import { RidesView } from "@/modules/RidesView";
import { CaptainsView } from "@/modules/CaptainsView";
import { KYCQueueView } from "@/modules/KYCQueueView";
import { SecondChanceView } from "@/modules/SecondChanceView";
import { PassengersView } from "@/modules/PassengersView";
import { SafetyConsoleView } from "@/modules/SafetyConsoleView";
import { FinanceView } from "@/modules/FinanceView";
import { PricingConfigView } from "@/modules/PricingConfigView";
import { StaffRolesView } from "@/modules/StaffRolesView";
import { AuditLogsView } from "@/modules/AuditLogsView";

export default function AdminConsolePage() {
  // Global Operational State
  const [currentTab, setCurrentTab] = useState<AdminTab>("dashboard");
  const [activeRole, setActiveRole] = useState<StaffRole>("SUPER_ADMIN");
  const [currentUser, setCurrentUser] = useState<StaffUser>(MOCK_STAFF_USERS[0]);
  const [selectedCity, setSelectedCity] = useState<string>("All Cities");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Data Stores
  const [rides, setRides] = useState<Ride[]>(MOCK_RIDES);
  const [captains, setCaptains] = useState<Captain[]>(MOCK_CAPTAINS);
  const [riders, setRiders] = useState<Rider[]>(MOCK_RIDERS);
  const [sosIncidents, setSosIncidents] = useState<SOSIncident[]>(MOCK_SOS_INCIDENTS);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [payoutBatches, setPayoutBatches] = useState<PayoutBatch[]>(MOCK_PAYOUT_BATCHES);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>(MOCK_REFUND_REQUESTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [pricingConfigs, setPricingConfigs] = useState<CityPricingConfig[]>(MOCK_PRICING_CONFIGS);
  const [geofences, setGeofences] = useState<GeofenceZone[]>(MOCK_GEOFENCES);
  const [staffList, setStaffList] = useState<StaffUser[]>(MOCK_STAFF_USERS);

  // Active Drawers & Modals
  const [inspectingRide, setInspectingRide] = useState<Ride | null>(null);
  const [inspectingKycCaptain, setInspectingKycCaptain] = useState<Captain | null>(null);
  const [inspectingSosIncident, setInspectingSosIncident] = useState<SOSIncident | null>(null);

  // Helper to append audit trail entries
  const appendAuditLog = (
    action: string,
    category: AuditLogEntry["category"],
    targetId: string,
    targetType: string,
    reasonNotes: string,
    diff?: { before: Record<string, unknown>; after: Record<string, unknown> }
  ) => {
    const newLog: AuditLogEntry = {
      id: `audit-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      actor: {
        name: currentUser.name,
        email: currentUser.email,
        role: activeRole,
      },
      action,
      category,
      targetId,
      targetType,
      ipAddress: "192.168.1.100 (Console Client)",
      reasonNotes,
      diff,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Operational Intervention Handlers:
  // 1. Cancel Ride
  const handleCancelRide = (rideId: string, reason: string) => {
    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId
          ? {
              ...r,
              status: "CANCELLED",
              paymentStatus: "REFUNDED",
              timeline: [
                ...r.timeline,
                {
                  status: "CANCELLED",
                  title: "Emergency Cancellation by Admin",
                  timestamp: new Date().toLocaleTimeString(),
                  description: `Cancelled by ${currentUser.name}. Reason: ${reason}`,
                },
              ],
            }
          : r
      )
    );
    appendAuditLog("RIDE_EMERGENCY_CANCELLED", "RIDE", rideId, "Ride", reason);
    if (inspectingRide?.id === rideId) {
      setInspectingRide((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
    }
  };

  // 2. Reassign Driver
  const handleReassignDriver = (rideId: string, reason: string) => {
    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId
          ? {
              ...r,
              status: "SEARCHING",
              captain: undefined,
              timeline: [
                ...r.timeline,
                {
                  status: "SEARCHING",
                  title: "Driver Reassigned by Dispatch",
                  timestamp: new Date().toLocaleTimeString(),
                  description: `Reassigned by ${currentUser.name}. Reason: ${reason}`,
                },
              ],
            }
          : r
      )
    );
    appendAuditLog("RIDE_DRIVER_REASSIGNED", "RIDE", rideId, "Ride", reason);
    if (inspectingRide?.id === rideId) {
      setInspectingRide((prev) =>
        prev ? { ...prev, status: "SEARCHING", captain: undefined } : null
      );
    }
  };

  // 3. Adjust Fare
  const handleAdjustFare = (rideId: string, amount: number, reason: string) => {
    setRides((prev) =>
      prev.map((r) => {
        if (r.id === rideId) {
          const oldGross = r.fare.grossFare;
          const newGross = Math.max(0, oldGross + amount);
          return {
            ...r,
            fare: {
              ...r.fare,
              grossFare: newGross,
              captainNetPayout: newGross * 0.85,
            },
          };
        }
        return r;
      })
    );
    appendAuditLog("RIDE_FARE_ADJUSTED", "FINANCE", rideId, "Ride", reason, {
      before: { adjustment: 0 },
      after: { adjustment: amount },
    });
  };

  // 4. KYC Approve
  const handleApproveCaptain = (captainId: string, reason: string) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              status: "ACTIVE",
              documents: c.documents.map((d) => ({
                ...d,
                status: "VERIFIED",
                verifiedAt: new Date().toISOString(),
                verifiedBy: currentUser.name,
              })),
            }
          : c
      )
    );
    appendAuditLog("CAPTAIN_KYC_APPROVED", "CAPTAIN", captainId, "Captain", reason);
    setInspectingKycCaptain(null);
  };

  // 5. KYC Reject
  const handleRejectCaptain = (captainId: string, reason: string) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              status: "SUSPENDED",
              documents: c.documents.map((d) => ({
                ...d,
                status: "REJECTED",
                rejectionReason: reason,
              })),
            }
          : c
      )
    );
    appendAuditLog("CAPTAIN_KYC_REJECTED", "CAPTAIN", captainId, "Captain", reason);
    setInspectingKycCaptain(null);
  };

  // 6. Request Resubmission
  const handleRequestResubmission = (captainId: string, docId: string, note: string) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              documents: c.documents.map((d) =>
                d.id === docId
                  ? { ...d, status: "RESUBMISSION_REQUESTED", rejectionReason: note }
                  : d
              ),
            }
          : c
      )
    );
    appendAuditLog(
      "CAPTAIN_DOC_RESUBMISSION_REQUESTED",
      "CAPTAIN",
      captainId,
      "CaptainDocument",
      note
    );
    if (inspectingKycCaptain) {
      setInspectingKycCaptain((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.map((d) =>
                d.id === docId
                  ? { ...d, status: "RESUBMISSION_REQUESTED", rejectionReason: note }
                  : d
              ),
            }
          : null
      );
    }
  };

  // 7. Second Chance Enroll & Conditions Update
  const handleEnrollSecondChance = (captainId: string) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              secondChance: {
                ...c.secondChance,
                isEnrolled: true,
                tier: "TIER_1_PROBATION",
                enrolledDate: new Date().toISOString().split("T")[0],
                speedGovernorEnabled: true,
                maxDailyHours: 6,
                restrictedNightDriving: true,
                probationRidesTarget: 250,
                probationRidesCompleted: 0,
                eligibilityNotes: "Enrolled by administrator for probationary second-chance track.",
              },
            }
          : c
      )
    );
    appendAuditLog(
      "CAPTAIN_SECOND_CHANCE_ENROLLED",
      "CAPTAIN",
      captainId,
      "Captain",
      "Enrolled under Section 28 PRD guidelines."
    );
  };

  const handleUpdateSecondChanceConditions = (
    captainId: string,
    cond: { maxDailyHours: number; speedGovernor: boolean; restrictedNight: boolean }
  ) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              secondChance: {
                ...c.secondChance,
                maxDailyHours: cond.maxDailyHours,
                speedGovernorEnabled: cond.speedGovernor,
                restrictedNightDriving: cond.restrictedNight,
              },
            }
          : c
      )
    );
    appendAuditLog(
      "SECOND_CHANCE_CONDITIONS_UPDATED",
      "CAPTAIN",
      captainId,
      "Captain",
      `Conditions updated: Max ${cond.maxDailyHours} hrs, Governor: ${cond.speedGovernor}`
    );
  };

  const handlePromoteSecondChanceTier = (captainId: string, newTier: string) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              secondChance: {
                ...c.secondChance,
                tier: newTier as any,
                complianceScore: 99.5,
              },
            }
          : c
      )
    );
    appendAuditLog(
      "SECOND_CHANCE_TIER_PROMOTED",
      "CAPTAIN",
      captainId,
      "Captain",
      `Promoted to ${newTier} after milestone completion.`
    );
  };

  const handleRevokeSecondChance = (captainId: string, reason: string) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              secondChance: {
                ...c.secondChance,
                isEnrolled: false,
              },
            }
          : c
      )
    );
    appendAuditLog("SECOND_CHANCE_REVOKED", "CAPTAIN", captainId, "Captain", reason);
  };

  // 8. Suspend Captain & Passenger
  const handleToggleSuspendCaptain = (captainId: string, reason: string) => {
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              status: c.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
            }
          : c
      )
    );
    appendAuditLog("CAPTAIN_SUSPENSION_TOGGLED", "CAPTAIN", captainId, "Captain", reason);
  };

  const handleToggleSuspendRider = (riderId: string, reason: string) => {
    setRiders((prev) =>
      prev.map((r) =>
        r.id === riderId
          ? {
              ...r,
              status: r.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
            }
          : r
      )
    );
    appendAuditLog("RIDER_SUSPENSION_TOGGLED", "RIDE", riderId, "Rider", reason);
  };

  const handleAddWalletCredit = (riderId: string, amount: number, note: string) => {
    setRiders((prev) =>
      prev.map((r) =>
        r.id === riderId ? { ...r, walletBalance: r.walletBalance + amount } : r
      )
    );
    appendAuditLog("GOODWILL_WALLET_CREDITED", "FINANCE", riderId, "Rider", note);
  };

  // 9. SOS Acknowledge & Resolve
  const handleAcknowledgeSOS = (incidentId: string) => {
    setSosIncidents((prev) =>
      prev.map((s) =>
        s.id === incidentId
          ? {
              ...s,
              status: "ACKNOWLEDGED",
              responderNotes: [
                ...s.responderNotes,
                `${new Date().toLocaleTimeString()} - Acknowledged by staff ${currentUser.name}`,
              ],
            }
          : s
      )
    );
    appendAuditLog(
      "SOS_ACKNOWLEDGED",
      "SAFETY",
      incidentId,
      "SOSIncident",
      "Acknowledged within operational SLA threshold."
    );
  };

  const handleResolveSOS = (
    incidentId: string,
    resolutionType: "RESOLVED" | "FALSE_ALARM",
    notes: string
  ) => {
    setSosIncidents((prev) =>
      prev.map((s) =>
        s.id === incidentId
          ? {
              ...s,
              status: resolutionType,
              resolvedAt: new Date().toISOString(),
              responderNotes: [
                ...s.responderNotes,
                `${new Date().toLocaleTimeString()} - Resolution: ${notes}`,
              ],
            }
          : s
      )
    );
    appendAuditLog(
      resolutionType === "RESOLVED" ? "SOS_INCIDENT_RESOLVED" : "SOS_MARKED_FALSE_ALARM",
      "SAFETY",
      incidentId,
      "SOSIncident",
      notes
    );
  };

  // 10. Financial Refunds & Payouts
  const handleApproveRefund = (refundId: string, reason: string) => {
    setRefundRequests((prev) =>
      prev.map((r) =>
        r.id === refundId
          ? {
              ...r,
              status: "APPROVED",
              reviewedBy: currentUser.name,
              reviewNotes: reason,
            }
          : r
      )
    );
    appendAuditLog("REFUND_CLAIM_APPROVED", "FINANCE", refundId, "RefundRequest", reason);
  };

  const handleRejectRefund = (refundId: string, reason: string) => {
    setRefundRequests((prev) =>
      prev.map((r) =>
        r.id === refundId
          ? {
              ...r,
              status: "REJECTED",
              reviewedBy: currentUser.name,
              reviewNotes: reason,
            }
          : r
      )
    );
    appendAuditLog("REFUND_CLAIM_REJECTED", "FINANCE", refundId, "RefundRequest", reason);
  };

  const handleTriggerPayoutBatch = (batchId: string, reason: string) => {
    setPayoutBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              status: "COMPLETED",
              settledAt: new Date().toISOString(),
            }
          : b
      )
    );
    appendAuditLog("PAYOUT_BATCH_SETTLED", "FINANCE", batchId, "PayoutBatch", reason);
  };

  // 11. Pricing Matrix Save
  const handleSavePricing = (updatedConfig: CityPricingConfig, reason: string) => {
    setPricingConfigs((prev) =>
      prev.map((c) => (c.city === updatedConfig.city ? updatedConfig : c))
    );
    appendAuditLog("PRICING_CONFIG_UPDATED", "CONFIG", updatedConfig.city, "CityPricing", reason);
  };

  // 12. Staff Management
  const handleInviteStaff = (newStaff: {
    name: string;
    email: string;
    role: StaffRole;
    cityScope: string[];
  }) => {
    const created: StaffUser = {
      id: `staff-${Date.now().toString().slice(-3)}`,
      name: newStaff.name,
      email: newStaff.email,
      role: newStaff.role,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      cityScope: newStaff.cityScope,
      is2FAEnabled: false,
      lastLogin: "Invitation Pending",
      status: "INVITED",
    };
    setStaffList((prev) => [...prev, created]);
    appendAuditLog(
      "STAFF_COADMIN_INVITED",
      "STAFF",
      created.id,
      "StaffUser",
      `Invited with role ${newStaff.role} and scope ${newStaff.cityScope.join(",")}`
    );
  };

  const handleToggleStaffStatus = (staffId: string, reason: string) => {
    setStaffList((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? { ...s, status: s.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }
          : s
      )
    );
    appendAuditLog("STAFF_STATUS_TOGGLED", "STAFF", staffId, "StaffUser", reason);
  };

  const handleReset2FA = (staffId: string, reason: string) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, is2FAEnabled: false } : s))
    );
    appendAuditLog("STAFF_2FA_RESET", "STAFF", staffId, "StaffUser", reason);
  };

  // Active SOS
  const activeSOS = sosIncidents.find((s) => s.status === "ACTIVE") || null;
  const pendingKycCount = captains.filter(
    (c) =>
      c.status === "PENDING_REVIEW" ||
      c.documents.some((d) => d.status === "PENDING" || d.status === "RESUBMISSION_REQUESTED")
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBFC] dark:bg-[#0F0811] text-[#1C121A] dark:text-[#FBF8FA] transition-colors">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        activeRole={activeRole}
        onChangeRole={(newRole) => {
          setActiveRole(newRole);
          const found = staffList.find((s) => s.role === newRole);
          if (found) setCurrentUser(found);
        }}
        selectedCity={selectedCity}
        onChangeCity={setSelectedCity}
        activeRidesCount={rides.filter((r) => r.status === "ON_TRIP" || r.status === "ARRIVING").length}
        onlineCaptainsCount={captains.filter((c) => c.status === "ACTIVE" || c.status === "ON_TRIP").length}
        activeSosIncident={activeSOS}
        onOpenSOSModal={() => setInspectingSosIncident(activeSOS)}
      />

      {/* Main Workspace: Left Sidebar + Center View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          activeRole={activeRole}
          pendingKycCount={pendingKycCount}
          activeSosCount={activeSOS ? 1 : 0}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Dynamic Content View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentTab === "dashboard" && (
            <DashboardView
              rides={rides}
              captains={captains}
              sosIncidents={sosIncidents}
              selectedCity={selectedCity}
              onSelectRide={(r) => setInspectingRide(r)}
              onOpenSOSModal={() => setInspectingSosIncident(activeSOS)}
              onNavigateToTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === "live-ops" && (
            <LiveOpsView
              rides={rides}
              captains={captains}
              sosIncidents={sosIncidents}
              selectedCity={selectedCity}
              role={activeRole}
              onSelectRide={(r) => setInspectingRide(r)}
              onOpenSOSModal={() => setInspectingSosIncident(activeSOS)}
            />
          )}

          {currentTab === "rides" && (
            <RidesView
              rides={rides}
              selectedCity={selectedCity}
              role={activeRole}
              onSelectRide={(r) => setInspectingRide(r)}
            />
          )}

          {currentTab === "captains" && (
            <CaptainsView
              captains={captains}
              selectedCity={selectedCity}
              role={activeRole}
              onOpenKYCViewer={(c) => setInspectingKycCaptain(c)}
              onToggleSuspend={handleToggleSuspendCaptain}
              onNavigateToSecondChance={() => setCurrentTab("second-chance")}
            />
          )}

          {currentTab === "kyc-queue" && (
            <KYCQueueView
              captains={captains}
              selectedCity={selectedCity}
              role={activeRole}
              onOpenKYCViewer={(c) => setInspectingKycCaptain(c)}
            />
          )}

          {currentTab === "second-chance" && (
            <SecondChanceView
              captains={captains}
              selectedCity={selectedCity}
              role={activeRole}
              onUpdateConditions={handleUpdateSecondChanceConditions}
              onPromoteTier={handlePromoteSecondChanceTier}
              onRevokeSecondChance={handleRevokeSecondChance}
            />
          )}

          {currentTab === "passengers" && (
            <PassengersView
              riders={riders}
              selectedCity={selectedCity}
              role={activeRole}
              onToggleSuspend={handleToggleSuspendRider}
              onAddWalletCredit={handleAddWalletCredit}
            />
          )}

          {currentTab === "safety" && (
            <SafetyConsoleView
              incidents={sosIncidents}
              rides={rides}
              role={activeRole}
              onOpenSOSModal={(inc) => setInspectingSosIncident(inc)}
              onAcknowledge={handleAcknowledgeSOS}
            />
          )}

          {currentTab === "finance" && (
            <FinanceView
              transactions={transactions}
              payoutBatches={payoutBatches}
              refundRequests={refundRequests}
              role={activeRole}
              onApproveRefund={handleApproveRefund}
              onRejectRefund={handleRejectRefund}
              onTriggerPayoutBatch={handleTriggerPayoutBatch}
            />
          )}

          {currentTab === "pricing" && (
            <PricingConfigView
              configs={pricingConfigs}
              geofences={geofences}
              role={activeRole}
              onSavePricing={handleSavePricing}
            />
          )}

          {currentTab === "staff" && (
            <StaffRolesView
              staffList={staffList}
              role={activeRole}
              onInviteStaff={handleInviteStaff}
              onToggleStaffStatus={handleToggleStaffStatus}
              onReset2FA={handleReset2FA}
            />
          )}

          {currentTab === "audit" && (
            <AuditLogsView logs={auditLogs} role={activeRole} />
          )}
        </main>
      </div>

      {/* Flyout Modals and Drawers */}
      {/* 1. Ride Drawer */}
      <RideDrawer
        ride={inspectingRide}
        role={activeRole}
        onClose={() => setInspectingRide(null)}
        onCancelRide={handleCancelRide}
        onReassignDriver={handleReassignDriver}
        onAdjustFare={handleAdjustFare}
      />

      {/* 2. KYC Document Viewer */}
      <KYCDocumentViewer
        captain={inspectingKycCaptain}
        role={activeRole}
        onClose={() => setInspectingKycCaptain(null)}
        onApprove={handleApproveCaptain}
        onReject={handleRejectCaptain}
        onRequestResubmission={handleRequestResubmission}
        onEnrollSecondChance={handleEnrollSecondChance}
      />

      {/* 3. SOS Incident Command Console */}
      <SOSCommandModal
        incident={inspectingSosIncident}
        role={activeRole}
        onClose={() => setInspectingSosIncident(null)}
        onAcknowledge={handleAcknowledgeSOS}
        onResolve={handleResolveSOS}
      />
    </div>
  );
}
