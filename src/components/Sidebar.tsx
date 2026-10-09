"use client";

import React, { useRef } from "react";
import {
  LayoutDashboard,
  Radar,
  Car,
  Users,
  FileCheck,
  HeartHandshake,
  ShieldAlert,
  Wallet,
  Settings2,
  UserCog,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { PermissionKey } from "@/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEscapeKey, useFocusTrap, useScrollLock } from "@/lib/hooks/useOverlay";

export type AdminTab =
  | "dashboard"
  | "live-ops"
  | "rides"
  | "captains"
  | "kyc-queue"
  | "second-chance"
  | "passengers"
  | "safety"
  | "finance"
  | "pricing"
  | "staff"
  | "audit";

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  pendingKycCount: number;
  activeSosCount: number;
  pendingSecondChanceCount: number;
  pendingRefundsCount: number;
  /** Desktop (lg+) only: icon-only rail. */
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Below lg the sidebar is an off-canvas drawer controlled by the shell. */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ElementType;
  permission: PermissionKey;
  badge?: number;
  badgeVariant?: "coral" | "plum" | "teal";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingKycCount,
  activeSosCount,
  pendingSecondChanceCount,
  pendingRefundsCount,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}) => {
  const { can } = useAuth();
  const sections: NavSection[] = [
    {
      title: "OPERATIONS",
      items: [
        {
          id: "dashboard",
          label: "Executive Overview",
          icon: LayoutDashboard,
          permission: "dashboard.view",
        },
        {
          id: "live-ops",
          label: "Live Fleet Radar",
          icon: Radar,
          permission: "rides.view",
        },
        {
          id: "rides",
          label: "Rides & Dispatch",
          icon: Car,
          permission: "rides.view",
        },
      ],
    },
    {
      title: "FLEET & CAPTAINS",
      items: [
        {
          id: "captains",
          label: "Captain Fleet",
          icon: Users,
          permission: "captains.view",
        },
        {
          id: "kyc-queue",
          label: "KYC Approval Queue",
          icon: FileCheck,
          permission: "captains.approve",
          badge: pendingKycCount,
          badgeVariant: "plum",
        },
        {
          id: "second-chance",
          label: "Second Chance Program",
          icon: HeartHandshake,
          permission: "second_chance.manage",
          badge: pendingSecondChanceCount,
          badgeVariant: "coral",
        },
      ],
    },
    {
      title: "RIDERS & SAFETY",
      items: [
        {
          id: "passengers",
          label: "Passengers Directory",
          icon: Users,
          permission: "users.view",
        },
        {
          id: "safety",
          label: "Safety & SOS Console",
          icon: ShieldAlert,
          permission: "safety.manage",
          badge: activeSosCount,
          badgeVariant: "coral",
        },
      ],
    },
    {
      title: "FINANCIALS",
      items: [
        {
          id: "finance",
          label: "Payments & Ledger",
          icon: Wallet,
          permission: "finance.view",
          badge: pendingRefundsCount,
          badgeVariant: "plum",
        },
      ],
    },
    {
      title: "GOVERNANCE",
      items: [
        {
          id: "pricing",
          label: "Pricing & Geofences",
          icon: Settings2,
          permission: "config.view",
        },
        {
          id: "staff",
          label: "Staff & Role RBAC",
          icon: UserCog,
          permission: "staff.view",
        },
        {
          id: "audit",
          label: "Audit Trail & Logs",
          icon: ScrollText,
          permission: "audit.view",
        },
      ],
    },
  ];

  const drawerRef = useRef<HTMLElement>(null);
  useScrollLock(mobileOpen);
  useEscapeKey(mobileOpen, onMobileClose);
  useFocusTrap(drawerRef, mobileOpen);

  const renderNav = (collapsed: boolean) => (
    <nav aria-label="Primary" className="space-y-6">
      {sections.map((section) => {
        // Only show what the signed-in staff member is permitted to open
        const visibleItems = section.items.filter((item) => can(item.permission));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{section.title}</p>
            )}
            {collapsed && <div className="mx-3 h-px bg-[#F0E3ED] dark:bg-[#331A3B]" aria-hidden="true" />}
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const hasBadge = item.badge !== undefined && item.badge > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? (hasBadge ? `${item.label} (${item.badge})` : item.label) : undefined}
                  className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors lg:min-h-10 lg:text-xs ${
                    collapsed ? "lg:justify-center" : ""
                  } ${
                    isActive
                      ? "bg-[#3A102F] text-white shadow-sm dark:bg-[#7A2B66]"
                      : "text-slate-600 hover:bg-[#FAF0F7] hover:text-[#3A102F] dark:text-slate-300 dark:hover:bg-[#28162E] dark:hover:text-[#E9BFDF]"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-[18px] w-[18px] shrink-0 lg:h-4 lg:w-4 ${
                      isActive ? "text-[#FF7361]" : "text-slate-500 group-hover:text-[#7A2B66] dark:text-slate-400 dark:group-hover:text-[#DB99CC]"
                    }`}
                  />
                  {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}

                  {!collapsed && hasBadge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.badgeVariant === "coral"
                          ? "bg-[#F94B35] text-white motion-safe:animate-pulse"
                          : "bg-[#FAF0F7] text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {collapsed && hasBadge && (
                    <span
                      aria-hidden="true"
                      className={`absolute right-2 top-2 h-2 w-2 rounded-full ring-2 ring-white dark:ring-[#180D1C] ${
                        item.badgeVariant === "coral" ? "bg-[#F94B35]" : "bg-[#A74490]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Persistent rail (lg and up): sticky, fills the viewport below the header, collapsible */}
      <aside
        className={`sticky top-[var(--header-h,4rem)] z-30 hidden h-[calc(100dvh-var(--header-h,4rem))] shrink-0 flex-col border-r border-[#F0E3ED] bg-white transition-[width] duration-300 motion-reduce:transition-none dark:border-[#331A3B] dark:bg-[#180D1C] lg:flex ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">{renderNav(isCollapsed)}</div>

        <div className="border-t border-[#F0E3ED] p-3 dark:border-[#331A3B]">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl p-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#28162E]"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Off-canvas drawer (below lg): backdrop + slide-in panel; closes on backdrop tap, Esc and navigation */}
      <div
        className={`fixed inset-0 z-[90] lg:hidden ${mobileOpen ? "visible" : "invisible transition-[visibility] delay-300 motion-reduce:delay-0"}`}
      >
        <div
          aria-hidden="true"
          onClick={onMobileClose}
          className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          id="mobile-nav"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          tabIndex={-1}
          inert={!mobileOpen}
          className={`absolute inset-y-0 left-0 flex h-dvh w-[85%] max-w-80 flex-col overflow-hidden border-r border-[#F0E3ED] bg-white shadow-2xl outline-none transition-transform duration-300 ease-out motion-reduce:transition-none dark:border-[#331A3B] dark:bg-[#180D1C] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#F0E3ED] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-[#331A3B]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#3A102F] text-white shadow-md dark:bg-[#7A2B66]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F94B35]" />
              </span>
              <span className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Amoor<span className="text-[#F94B35]">Go</span>
              </span>
              <span className="rounded-md bg-[#FAF0F7] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]">
                OPS
              </span>
            </div>
            <button
              type="button"
              onClick={onMobileClose}
              data-autofocus
              aria-label="Close navigation"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#28162E]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">{renderNav(false)}</div>
          <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
        </aside>
      </div>
    </>
  );
};
