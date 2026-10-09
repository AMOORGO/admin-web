"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Moon, Sun, Shield, Siren, Globe, LogOut, Menu, Loader2 } from "lucide-react";
import { SOSIncident } from "@/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { applyTheme, getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { avatarFor, humanize } from "@/lib/format";
import { DEMO_ROLE_OPTIONS, type DemoRoleKey } from "@/lib/demo/flag";
import { useEscapeKey } from "@/lib/hooks/useOverlay";

interface NavbarProps {
  activeRidesCount: number;
  onlineCaptainsCount: number;
  activeSosIncident?: SOSIncident | null;
  onOpenSOSModal: () => void;
  /** Opens the off-canvas navigation drawer (below lg). */
  onOpenNav: () => void;
  navOpen: boolean;
}

const selectClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 dark:border-[#331A3B] dark:bg-[#211226] dark:text-slate-100";

export const Navbar: React.FC<NavbarProps> = ({ activeRidesCount, onlineCaptainsCount, activeSosIncident, onOpenSOSModal, onOpenNav, navOpen }) => {
  const { user, logout, isDemo, demoRole, switchDemoRole } = useAuth();
  const { cities, selectedCityId, setSelectedCityId } = useCities();
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "light" as Theme);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Apply the stored theme to <html> after hydration (DOM only; no React state involved).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Publish the live header height (demo banner included) so the sticky sidebar fills exactly the rest of the viewport.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty("--header-h", `${el.getBoundingClientRect().height}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--header-h");
    };
  }, []);

  const closeMenu = () => {
    setShowUserMenu(false);
    menuButtonRef.current?.focus({ preventScroll: true });
  };
  useEscapeKey(showUserMenu, closeMenu);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const roleLabel = (user?.roles ?? []).map((r) => humanize(r)).join(", ") || "No role";
  const scopeLabel = user && user.cityScope.length > 0 ? `${user.cityScope.length} city scope` : "All cities";
  const permissionsTitle = (user?.permissions ?? []).join(", ");

  const citySelect = (id: string, className: string) => (
    <select
      id={id}
      value={selectedCityId ?? ""}
      onChange={(e) => setSelectedCityId(e.target.value || null)}
      aria-label="City filter"
      className={className}
    >
      <option value="">All Cities</option>
      {cities.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  const demoRoleSelect = (className: string) => (
    <select aria-label="Demo role" value={demoRole} onChange={(e) => void switchDemoRole(e.target.value as DemoRoleKey)} className={className}>
      {DEMO_ROLE_OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 w-full border-b border-[#F0E3ED] bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-colors dark:border-[#331A3B] dark:bg-[#180D1C]/95"
    >
      {isDemo && (
        <div
          role="status"
          className="flex min-h-10 items-center justify-center gap-2 bg-[#3A102F] px-3 py-1 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] text-xs font-semibold text-white"
        >
          <span className="min-w-0 truncate">
            <span className="sm:hidden">Demo mode · sample data</span>
            <span className="hidden sm:inline">Demo mode — sample data, changes are not saved</span>
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="shrink-0 whitespace-nowrap rounded-md border border-white/50 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-white hover:text-[#3A102F] focus-visible:outline-2 focus-visible:outline-white"
          >
            Exit demo
          </button>
        </div>
      )}

      <div className="flex h-14 items-center gap-2 px-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:h-16 sm:gap-3 sm:px-6">
        {/* Hamburger (below lg): opens the off-canvas navigation drawer */}
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="mobile-nav"
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#28162E] lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Brand */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3A102F] text-white shadow-md dark:bg-[#7A2B66]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F94B35]" />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            Amoor<span className="text-[#D93320] dark:text-[#FF7361]">Go</span>
          </span>
          <span className="hidden rounded-md bg-[#FAF0F7] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF] sm:inline">
            OPS
          </span>
        </div>

        {/* City selector (md and up; on phones it lives in the account menu) */}
        <div className="ml-1 hidden min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-[#331A3B] dark:bg-[#211226] md:flex">
          <Globe className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          {citySelect("city-header", "max-w-[10rem] cursor-pointer truncate bg-transparent font-semibold text-slate-700 dark:text-slate-200")}
        </div>

        {/* Live counters (xl and up) */}
        <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 text-xs dark:border-[#331A3B] xl:flex">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-[#26B896] motion-safe:animate-pulse" />
            <span className="text-slate-600 dark:text-slate-300">Active Rides:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{activeRidesCount}</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-[#A74490]" />
            <span className="text-slate-600 dark:text-slate-300">Captains Online:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{onlineCaptainsCount}</span>
          </div>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
          {/* Active emergency beacon: icon-only (with the SLA countdown) on phones, labelled from sm up */}
          {activeSosIncident && (
            <button
              type="button"
              onClick={onOpenSOSModal}
              aria-label={`SOS active, ${activeSosIncident.slaSecondsLeft} seconds left. Open the SOS console`}
              className="animate-sos relative flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[#F94B35] bg-[#FFF3F1] text-xs font-bold text-[#D93320] shadow-md transition-colors hover:bg-[#F94B35] hover:text-white dark:bg-[#38110D] dark:text-[#FF7361] dark:hover:text-white sm:w-auto sm:px-3"
            >
              <Siren className="h-5 w-5 shrink-0 motion-safe:animate-bounce sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="hidden whitespace-nowrap sm:inline">
                SOS<span className="hidden lg:inline"> ACTIVE</span> ({activeSosIncident.slaSecondsLeft}s)
              </span>
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-[#D93320] px-1 text-[9px] font-black leading-4 text-white ring-2 ring-white dark:ring-[#180D1C] sm:hidden"
              >
                {activeSosIncident.slaSecondsLeft}s
              </span>
            </button>
          )}

          {/* Signed-in role(s): permissions come from the backend, not from a client-side switcher */}
          {isDemo ? (
            <label
              className="hidden min-h-10 items-center gap-2 rounded-xl border border-[#E9BFDF] bg-[#FAF0F7] px-3 text-xs font-bold text-[#521A44] dark:border-[#521A44] dark:bg-[#331A3B] dark:text-[#E9BFDF] lg:flex"
              title={permissionsTitle}
            >
              <Shield className="h-3.5 w-3.5 shrink-0 text-[#7A2B66] dark:text-[#DB99CC]" aria-hidden="true" />
              <span>Role:</span>
              {demoRoleSelect("max-w-[9rem] cursor-pointer bg-transparent font-bold")}
            </label>
          ) : (
            <div
              className="hidden min-h-10 max-w-[14rem] items-center gap-2 rounded-xl border border-[#E9BFDF] bg-[#FAF0F7] px-3 text-xs font-bold text-[#521A44] dark:border-[#521A44] dark:bg-[#331A3B] dark:text-[#E9BFDF] lg:flex"
              title={permissionsTitle}
            >
              <Shield className="h-3.5 w-3.5 shrink-0 text-[#7A2B66] dark:text-[#DB99CC]" aria-hidden="true" />
              <span className="truncate">{roleLabel}</span>
            </div>
          )}

          {/* Theme toggle (sm and up; on phones it lives in the account menu) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            title="Toggle light / dark theme"
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:text-black dark:border-[#331A3B] dark:bg-[#211226] dark:text-slate-300 dark:hover:text-white sm:flex"
          >
            {theme === "light" ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />}
          </button>

          {/* Account menu: avatar button + popover */}
          <div className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setShowUserMenu((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showUserMenu}
              aria-label="Account menu"
              className="flex h-11 items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-[#28162E]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarFor(user?.name, user?.avatarUrl)} alt="" className="h-8 w-8 shrink-0 rounded-full border border-[#7A2B66] object-cover" />
              <div className="hidden max-w-[11rem] text-left 2xl:block">
                <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{user?.name ?? ""}</p>
                <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{user?.email ?? ""}</p>
              </div>
            </button>

            {showUserMenu && (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => setShowUserMenu(false)} className="fixed inset-0 z-40 cursor-default" />
                <div
                  role="group"
                  aria-label="Account"
                  className="anim-pop absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-var(--header-h,4rem)-1rem)] w-[min(20rem,calc(100vw-1.5rem))] space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-[#F0E3ED] bg-white p-3 shadow-2xl dark:border-[#331A3B] dark:bg-[#180D1C]"
                >
                  <div className="min-w-0 border-b border-slate-100 pb-2 dark:border-[#331A3B]">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{user?.name ?? ""}</p>
                    <p className="break-all text-xs text-slate-600 dark:text-slate-300">{user?.email ?? ""}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                        {user?.totpEnabled ? "2FA Active • TOTP Verified" : "2FA not enabled"}
                      </span>
                    </div>
                  </div>

                  {/* Controls that do not fit the compact header live here */}
                  <div className="space-y-2.5 md:hidden">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">City</span>
                      {citySelect("city-menu", selectClass)}
                    </label>
                  </div>
                  <div className="space-y-1 lg:hidden">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Role</p>
                    {isDemo ? (
                      demoRoleSelect(selectClass)
                    ) : (
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100" title={permissionsTitle}>
                        <Shield className="h-4 w-4 shrink-0 text-[#7A2B66] dark:text-[#DB99CC]" aria-hidden="true" />
                        <span className="min-w-0 break-words">{roleLabel}</span>
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 xl:hidden">
                    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-[#211226]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active rides</p>
                      <p className="font-mono text-base font-black text-slate-900 dark:text-white">{activeRidesCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-[#211226]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Captains online</p>
                      <p className="font-mono text-base font-black text-slate-900 dark:text-white">{onlineCaptainsCount}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-[#211226] dark:text-slate-200 dark:hover:bg-[#28162E] sm:hidden"
                  >
                    {theme === "light" ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />}
                    {theme === "light" ? "Dark theme" : "Light theme"}
                  </button>

                  <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <p>Scope: {scopeLabel}</p>
                    <p>Last sign-in: {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setSigningOut(true);
                      setShowUserMenu(false);
                      await logout();
                    }}
                    disabled={signingOut}
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-200 disabled:opacity-60 dark:bg-[#211226] dark:text-slate-200 dark:hover:bg-[#28162E]"
                  >
                    {signingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
                    Sign Out Session
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
