"use client";

import React from "react";
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
} from "lucide-react";
import { PermissionKey } from "@/types";
import { useAuth } from "@/lib/auth/AuthProvider";

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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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

  return (
    <aside
      className={`relative flex flex-col border-r border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Scrollable Nav Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section, sIdx) => {
          // Only show what the signed-in staff member is permitted to open
          const visibleItems = section.items.filter((item) => can(item.permission));

          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.title}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#3A102F] text-white dark:bg-[#7A2B66] shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-[#FAF0F7] dark:hover:bg-[#28162E] hover:text-[#3A102F] dark:hover:text-[#E9BFDF]"
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive
                          ? "text-[#F94B35]"
                          : "text-slate-400 group-hover:text-[#7A2B66] dark:group-hover:text-[#DB99CC]"
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="flex-1 text-left truncate">{item.label}</span>
                    )}

                    {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.badgeVariant === "coral"
                            ? "bg-[#F94B35] text-white animate-pulse"
                            : "bg-[#FAF0F7] text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="border-t border-[#F0E3ED] dark:border-[#331A3B] p-3">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-xl p-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-[#28162E] transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
