"use client";

import React, { useEffect, useState } from "react";
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

/** Last tab the operator was on: survives the console re-mount when the demo role is switched. */
let lastTab: AdminTab = "dashboard";

export default function AdminConsolePage() {
  const { sessionEpoch } = useAuth();
  return (
    <AuthGate>
      {/* The key re-mounts the console (fresh data, permissions and city scope) when the demo role changes. */}
      <CityProvider key={sessionEpoch}>
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

  const [navOpen, setNavOpen] = useState(false);
  const [requestedTab, setRequestedTab] = useState<AdminTab>(lastTab);
  const setCurrentTab = (tab: AdminTab) => {
    lastTab = tab;
    setRequestedTab(tab);
    setNavOpen(false); // the off-canvas drawer closes on navigation
    window.scrollTo({ top: 0 });
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // The drawer only exists below lg: close it (and release its scroll lock) if the viewport grows past that.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Drawers & modals are keyed by id: each fetches its own detail from the API.
  const [inspectingRideId, setInspectingRideId] = useState<string | null>(null);
  const [inspectingKycCaptainId, setInspectingKycCaptainId] = useState<string | null>(null);
  const [inspectingSosIncidentId, setInspectingSosIncidentId] = useState<string | null>(null);

  // Fall back to the first tab the staff member may open when the requested one is not permitted.
  const currentTab: AdminTab | null = can(TAB_PERMISSION[requestedTab]) ? requestedTab : (TAB_ORDER.find((t) => can(TAB_PERMISSION[t])) ?? null);

  const openSos = (incidentId?: string) => setInspectingSosIncidentId(incidentId ?? sos.activeIncident?.id ?? null);

  return (
    <div className="flex min-h-dvh flex-col bg-[#FDFBFC] text-[#1C121A] transition-colors dark:bg-[#0F0811] dark:text-[#FBF8FA]">
      <Navbar
        activeRidesCount={counters.activeRides}
        onlineCaptainsCount={counters.onlineCaptains}
        activeSosIncident={sos.activeIncident}
        onOpenSOSModal={() => openSos()}
        onOpenNav={() => setNavOpen(true)}
        navOpen={navOpen}
      />

      <div className="flex min-w-0 flex-1">
        <Sidebar
          currentTab={currentTab ?? "dashboard"}
          onSelectTab={setCurrentTab}
          pendingKycCount={counters.pendingKyc}
          activeSosCount={Math.max(sos.openCount, counters.openSos)}
          pendingSecondChanceCount={counters.pendingSecondChance}
          pendingRefundsCount={counters.pendingRefunds}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          mobileOpen={navOpen}
          onMobileClose={() => setNavOpen(false)}
        />

        <main
          id="main"
          className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:p-6 lg:p-8"
        >
          {currentTab === null && (
            <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-10 text-center text-sm text-slate-500 dark:text-slate-400">
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
