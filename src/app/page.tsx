"use client";

import React, { useState } from "react";
import type { PermissionKey } from "@/types";
import { AuthGate } from "@/components/auth/AuthGate";
import { Navbar } from "@/components/Navbar";
import { Sidebar, AdminTab } from "@/components/Sidebar";
import { RideDrawer } from "@/components/RideDrawer";
import { KYCDocumentViewer } from "@/components/KYCDocumentViewer";
import { SOSCommandModal } from "@/components/SOSCommandModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CityProvider, useCities } from "@/lib/cities/CityProvider";
import { useRealtimeLifecycle } from "@/lib/realtime";
import { useShellCounters } from "@/lib/useShellCounters";
import { useSosAlerts } from "@/lib/safety/useSosAlerts";

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

/** Permission required to open each tab (mirrors the sidebar; the API remains the real gate). */
const TAB_PERMISSION: Record<AdminTab, PermissionKey> = {
  dashboard: "dashboard.view",
  "live-ops": "rides.view",
  rides: "rides.view",
  captains: "captains.view",
  "kyc-queue": "captains.approve",
  "second-chance": "second_chance.manage",
  passengers: "users.view",
  safety: "safety.manage",
  finance: "finance.view",
  pricing: "config.view",
  staff: "staff.view",
  audit: "audit.view",
};
const TAB_ORDER = Object.keys(TAB_PERMISSION) as AdminTab[];

export default function AdminConsolePage() {
  return (
    <AuthGate>
      <CityProvider>
        <ConsoleShell />
      </CityProvider>
    </AuthGate>
  );
}

function ConsoleShell() {
  useRealtimeLifecycle();
  const { can } = useAuth();
  const { selectedCityId } = useCities();
  const counters = useShellCounters(selectedCityId);
  const sos = useSosAlerts();

  const [requestedTab, setCurrentTab] = useState<AdminTab>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Drawers & modals are keyed by id: each fetches its own detail from the API.
  const [inspectingRideId, setInspectingRideId] = useState<string | null>(null);
  const [inspectingKycCaptainId, setInspectingKycCaptainId] = useState<string | null>(null);
  const [inspectingSosIncidentId, setInspectingSosIncidentId] = useState<string | null>(null);

  // Fall back to the first tab the staff member may open when the requested one is not permitted.
  const currentTab: AdminTab | null = can(TAB_PERMISSION[requestedTab]) ? requestedTab : (TAB_ORDER.find((t) => can(TAB_PERMISSION[t])) ?? null);

  const openSos = (incidentId?: string) => setInspectingSosIncidentId(incidentId ?? sos.activeIncident?.id ?? null);

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBFC] dark:bg-[#0F0811] text-[#1C121A] dark:text-[#FBF8FA] transition-colors">
      <Navbar
        activeRidesCount={counters.activeRides}
        onlineCaptainsCount={counters.onlineCaptains}
        activeSosIncident={sos.activeIncident}
        onOpenSOSModal={() => openSos()}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab ?? "dashboard"}
          onSelectTab={setCurrentTab}
          pendingKycCount={counters.pendingKyc}
          activeSosCount={Math.max(sos.openCount, counters.openSos)}
          pendingSecondChanceCount={counters.pendingSecondChance}
          pendingRefundsCount={counters.pendingRefunds}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentTab === null && (
            <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-10 text-center text-sm text-slate-500">
              Your account has no console permissions yet. Ask a Super Admin to assign a role.
            </div>
          )}

          {currentTab === "dashboard" && (
            <DashboardView
              selectedCityId={selectedCityId}
              onSelectRide={setInspectingRideId}
              onOpenSOSModal={openSos}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === "live-ops" && (
            <LiveOpsView selectedCityId={selectedCityId} onSelectRide={setInspectingRideId} onOpenSOSModal={openSos} />
          )}

          {currentTab === "rides" && <RidesView selectedCityId={selectedCityId} onSelectRide={setInspectingRideId} />}

          {currentTab === "captains" && (
            <CaptainsView
              selectedCityId={selectedCityId}
              onOpenKYCViewer={setInspectingKycCaptainId}
              onNavigateToSecondChance={() => setCurrentTab("second-chance")}
            />
          )}

          {currentTab === "kyc-queue" && <KYCQueueView selectedCityId={selectedCityId} onOpenKYCViewer={setInspectingKycCaptainId} />}

          {currentTab === "second-chance" && <SecondChanceView selectedCityId={selectedCityId} />}

          {currentTab === "passengers" && <PassengersView selectedCityId={selectedCityId} />}

          {currentTab === "safety" && <SafetyConsoleView selectedCityId={selectedCityId} onOpenSOSModal={openSos} />}

          {currentTab === "finance" && <FinanceView selectedCityId={selectedCityId} />}

          {currentTab === "pricing" && <PricingConfigView />}

          {currentTab === "staff" && <StaffRolesView />}

          {currentTab === "audit" && <AuditLogsView />}
        </main>
      </div>

      {/* Flyouts: each loads its own detail by id and reports changes through lib/invalidate */}
      <RideDrawer rideId={inspectingRideId} onClose={() => setInspectingRideId(null)} />
      <KYCDocumentViewer captainId={inspectingKycCaptainId} onClose={() => setInspectingKycCaptainId(null)} />
      <SOSCommandModal incidentId={inspectingSosIncidentId} onClose={() => setInspectingSosIncidentId(null)} />
    </div>
  );
}
