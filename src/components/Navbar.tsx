"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import {
  Moon,
  Sun,
  Shield,
  Siren,
  Globe,
  LogOut,
} from "lucide-react";
import { SOSIncident } from "@/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { applyTheme, getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { avatarFor, humanize } from "@/lib/format";

interface NavbarProps {
  activeRidesCount: number;
  onlineCaptainsCount: number;
  activeSosIncident?: SOSIncident | null;
  onOpenSOSModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRidesCount,
  onlineCaptainsCount,
  activeSosIncident,
  onOpenSOSModal,
}) => {
  const { user, logout, isDemo } = useAuth();
  const { cities, selectedCityId, setSelectedCityId } = useCities();
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "light" as Theme);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Apply the stored theme to <html> after hydration (DOM only; no React state involved).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const roleLabel = (user?.roles ?? []).map((r) => humanize(r)).join(", ") || "No role";
  const scopeLabel = user && user.cityScope.length > 0 ? `${user.cityScope.length} city scope` : "All cities";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#F0E3ED] dark:border-[#331A3B] bg-white/95 dark:bg-[#180D1C]/95 backdrop-blur-md transition-colors">
      {isDemo && (
        <div role="status" className="flex items-center justify-center gap-3 bg-[#3A102F] px-4 py-1.5 text-xs font-semibold text-white">
          <span>Demo mode — sample data, changes are not saved</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-white/40 px-2 py-0.5 text-[11px] font-bold text-white transition-colors hover:bg-white hover:text-[#3A102F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Exit demo
          </button>
        </div>
      )}
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
              value={selectedCityId ?? ""}
              onChange={(e) => setSelectedCityId(e.target.value || null)}
              aria-label="City filter"
              className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-[#180D1C]">
                All Cities
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-[#180D1C]">
                  {c.name}
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

        {/* Right: SOS alert, role, theme, profile */}
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

          {/* Signed-in role(s): permissions come from the backend, not from a client-side switcher */}
          <div
            className="flex items-center gap-2 rounded-xl border border-[#E9BFDF] dark:border-[#521A44] bg-[#FAF0F7] dark:bg-[#331A3B] px-3 py-1.5 text-xs font-bold text-[#521A44] dark:text-[#E9BFDF]"
            title={(user?.permissions ?? []).join(", ")}
          >
            <Shield className="h-3.5 w-3.5 text-[#7A2B66] dark:text-[#DB99CC]" />
            <span className="hidden sm:inline">Role:</span>
            <span>{roleLabel}</span>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarFor(user?.name, user?.avatarUrl)}
                alt={user?.name ?? "Staff"}
                className="h-8 w-8 rounded-full object-cover border border-[#7A2B66]"
              />
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {(user?.name ?? "")}
                </p>
                <p className="text-[10px] text-slate-400">{(user?.email ?? "")}</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-50 space-y-2">
                <div className="border-b border-slate-100 dark:border-[#331A3B] pb-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {(user?.name ?? "")}
                  </p>
                  <p className="text-[11px] text-slate-500">{(user?.email ?? "")}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      {user?.totpEnabled ? "2FA Active • TOTP Verified" : "2FA not enabled"}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>Scope: {scopeLabel}</p>
                  <p>Last sign-in: {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</p>
                </div>

                <button
                  onClick={async () => {
                    setSigningOut(true);
                    setShowUserMenu(false);
                    await logout();
                  }}
                  disabled={signingOut}
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
