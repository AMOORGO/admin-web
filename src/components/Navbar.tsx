"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Search,
  Moon,
  Sun,
  Shield,
  Siren,
  ChevronDown,
  Globe,
  Radio,
  User,
  LogOut,
  Sparkles,
} from "lucide-react";
import { StaffUser, StaffRole, SOSIncident } from "@/types";
import { Badge } from "./Badge";

interface NavbarProps {
  currentUser: StaffUser;
  activeRole: StaffRole;
  onChangeRole: (role: StaffRole) => void;
  selectedCity: string;
  onChangeCity: (city: string) => void;
  activeRidesCount: number;
  onlineCaptainsCount: number;
  activeSosIncident?: SOSIncident | null;
  onOpenSOSModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeRole,
  onChangeRole,
  selectedCity,
  onChangeCity,
  activeRidesCount,
  onlineCaptainsCount,
  activeSosIncident,
  onOpenSOSModal,
}) => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("amoorgo-theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("amoorgo-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const cities = ["All Cities", "Austin", "Dallas", "Houston", "Bengaluru", "Mumbai"];

  const roleOptions: { role: StaffRole; label: string; desc: string }[] = [
    { role: "SUPER_ADMIN", label: "Super Admin", desc: "Full root access across all domains" },
    { role: "OPERATIONS_ADMIN", label: "Operations Admin", desc: "Fleet, rides & safety interventions" },
    { role: "CAPTAIN_OPS", label: "Captain Ops", desc: "Driver KYC approvals & Second Chance" },
    { role: "FINANCE_ADMIN", label: "Finance Admin", desc: "Transactions, payouts & refund limits" },
    { role: "SUPPORT_AGENT", label: "Support Agent", desc: "Passenger & ride disputes" },
    { role: "READ_ONLY", label: "Read Only", desc: "Auditing & analytics viewing" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#F0E3ED] dark:border-[#331A3B] bg-white/95 dark:bg-[#180D1C]/95 backdrop-blur-md transition-colors">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left: Brand Identity & City Filter */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Logo with Coral dot */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3A102F] text-white shadow-md">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F94B35]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Amoor<span className="text-[#F94B35]">Go</span>
                </span>
                <span className="rounded-md bg-[#FAF0F7] dark:bg-[#331A3B] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[#7A2B66] dark:text-[#E9BFDF]">
                  OPS
                </span>
              </div>
            </div>
          </div>

          {/* City Selector Dropdown */}
          <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-3 py-1.5 text-xs">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedCity}
              onChange={(e) => onChangeCity(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {cities.map((c) => (
                <option key={c} value={c} className="bg-white dark:bg-[#180D1C]">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Live Operations Ticker */}
          <div className="hidden lg:flex items-center gap-3 border-l border-slate-200 dark:border-[#331A3B] pl-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#26B896] animate-pulse" />
              <span className="text-slate-500">Active Rides:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {activeRidesCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#A74490]" />
              <span className="text-slate-500">Captains Online:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {onlineCaptainsCount}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions, SOS Alert, Role Simulator, Profile */}
        <div className="flex items-center gap-3">
          {/* Active Emergency Beacon */}
          {activeSosIncident && (
            <button
              onClick={onOpenSOSModal}
              className="flex items-center gap-2 rounded-xl bg-[#FFF3F1] dark:bg-[#38110D] border-2 border-[#F94B35] px-3 py-1.5 text-xs font-bold text-[#F94B35] hover:bg-[#F94B35] hover:text-white transition-all shadow-md animate-sos"
            >
              <Siren className="h-4 w-4 animate-bounce" />
              <span>SOS ACTIVE ({activeSosIncident.slaSecondsLeft}s)</span>
            </button>
          )}

          {/* Role Preview Switcher Simulator */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 rounded-xl border border-[#E9BFDF] dark:border-[#521A44] bg-[#FAF0F7] dark:bg-[#331A3B] px-3 py-1.5 text-xs font-bold text-[#521A44] dark:text-[#E9BFDF] hover:opacity-90 transition-all shadow-xs"
            >
              <Shield className="h-3.5 w-3.5 text-[#7A2B66] dark:text-[#DB99CC]" />
              <span className="hidden sm:inline">Role:</span>
              <span>{activeRole.replace("_", " ")}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-50">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-[#331A3B]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Active RBAC Persona
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Test live permission gates & interventions across roles
                  </p>
                </div>
                <div className="space-y-1 mt-1">
                  {roleOptions.map((opt) => (
                    <button
                      key={opt.role}
                      onClick={() => {
                        onChangeRole(opt.role);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left rounded-xl p-2 text-xs transition-colors flex flex-col ${
                        activeRole === opt.role
                          ? "bg-[#FAF0F7] dark:bg-[#331A3B] text-[#7A2B66] dark:text-[#E9BFDF] font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#28162E]"
                      }`}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[10px] text-slate-400">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </button>

          {/* Staff User Avatar & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-[#28162E] transition-colors"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="h-8 w-8 rounded-full object-cover border border-[#7A2B66]"
              />
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-slate-400">{currentUser.email}</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-50 space-y-2">
                <div className="border-b border-slate-100 dark:border-[#331A3B] pb-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-slate-500">{currentUser.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      2FA Active • TOTP Verified
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>Scope: {currentUser.cityScope.join(", ")}</p>
                  <p>Session: {currentUser.lastLogin}</p>
                </div>

                <button
                  onClick={() => setShowUserMenu(false)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#211226] text-slate-700 dark:text-slate-300 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#28162E] transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
