"use client";

import React from "react";
import {
  TrendingUp,
  Car,
  Users,
  DollarSign,
  Clock,
  ShieldCheck,
  Siren,
  ArrowUpRight,
  AlertTriangle,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Ride, Captain, SOSIncident } from "@/types";
import { Badge } from "@/components/Badge";
import { LiveMap } from "@/components/LiveMap";

interface DashboardViewProps {
  rides: Ride[];
  captains: Captain[];
  sosIncidents: SOSIncident[];
  selectedCity: string;
  onSelectRide: (ride: Ride) => void;
  onOpenSOSModal: () => void;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rides,
  captains,
  sosIncidents,
  selectedCity,
  onSelectRide,
  onOpenSOSModal,
  onNavigateToTab,
}) => {
  const activeRides = rides.filter(
    (r) => r.status === "ON_TRIP" || r.status === "ARRIVING" || r.status === "ACCEPTED"
  );
  const onlineCaptains = captains.filter((c) => c.status === "ACTIVE" || c.status === "ON_TRIP");
  const pendingKyc = captains.filter((c) => c.status === "PENDING_REVIEW");
  const activeSOS = sosIncidents.find((s) => s.status === "ACTIVE");

  const kpis = [
    {
      title: "Active Rides Now",
      value: activeRides.length.toString(),
      trend: "+14% vs last hour",
      trendUp: true,
      icon: Car,
      color: "text-[#3A102F] dark:text-[#E9BFDF]",
      bgColor: "bg-[#FAF0F7] dark:bg-[#331A3B]",
    },
    {
      title: "Online Fleet",
      value: onlineCaptains.length.toString(),
      trend: "82% Utilization Rate",
      trendUp: true,
      icon: Users,
      color: "text-[#189578] dark:text-[#82E5CB]",
      bgColor: "bg-[#EFFCF9] dark:bg-[#0D2620]",
    },
    {
      title: "Today's Gross GMV",
      value: "$38,420",
      trend: "+8.4% WoW",
      trendUp: true,
      icon: DollarSign,
      color: "text-[#7A2B66] dark:text-[#DB99CC]",
      bgColor: "bg-[#FAF0F7] dark:bg-[#331A3B]",
    },
    {
      title: "Net Platform Take (15%)",
      value: "$5,763",
      trend: "Double-entry verified",
      trendUp: true,
      icon: TrendingUp,
      color: "text-[#189578] dark:text-[#82E5CB]",
      bgColor: "bg-[#EFFCF9] dark:bg-[#0D2620]",
    },
    {
      title: "Average Fleet ETA",
      value: "3.4 min",
      trend: "Target < 4.0 min",
      trendUp: true,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      title: "Safety / Active SOS",
      value: activeSOS ? "1 CRITICAL" : "0 Clean",
      trend: activeSOS ? "SLA 24s left" : "100% SLA compliance",
      trendUp: !activeSOS,
      icon: Siren,
      color: activeSOS ? "text-[#F94B35]" : "text-[#189578]",
      bgColor: activeSOS ? "bg-[#FFF3F1] dark:bg-[#38110D]" : "bg-[#EFFCF9] dark:bg-[#0D2620]",
      action: activeSOS ? onOpenSOSModal : undefined,
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner if SOS Active */}
      {activeSOS && (
        <div className="rounded-2xl border-2 border-[#F94B35] bg-[#FFF3F1] dark:bg-[#38110D] p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg animate-sos">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F94B35] text-white">
              <Siren className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-[#F94B35]">
                  Active Emergency Alert
                </span>
                <Badge variant="coral" size="sm" pulse>
                  SLA: {activeSOS.slaSecondsLeft}s
                </Badge>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Rider {activeSOS.userName} triggered SOS in {activeSOS.city}. Speed: {activeSOS.speedMph || 35} mph.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSOSModal}
            className="rounded-xl bg-[#F94B35] hover:bg-[#D93320] text-white px-5 py-2 text-xs font-bold transition-all shadow-md"
          >
            Open SOS Command Console
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={kpi.action}
              className={`rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 shadow-xs transition-all hover:shadow-md ${
                kpi.action ? "cursor-pointer hover:border-[#F94B35]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {kpi.title}
                </span>
                <div className={`rounded-xl p-2 ${kpi.bgColor} ${kpi.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {kpi.value}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  {kpi.trend}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Fleet Radar Map Widget */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#F94B35]" />
              Live Fleet Operations & Real-Time Telemetry
            </h2>
            <p className="text-xs text-slate-500">
              Clustered captains, moving vehicles, geofences and active dispatch tracks
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab("live-ops")}
            className="text-xs font-bold text-[#7A2B66] dark:text-[#DB99CC] hover:underline flex items-center gap-1"
          >
            Expanded Live Radar <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <LiveMap
          captains={captains}
          activeRides={activeRides}
          sosIncidents={sosIncidents}
          selectedCity={selectedCity}
          onSelectRide={onSelectRide}
        />
      </div>

      {/* Two Column Section: Dispatch Funnel + Urgent Operations Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Dispatch Funnel */}
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Real-time Dispatch Funnel (Last 60 mins)
            </h3>
            <Badge variant="teal" size="sm">
              Fulfillment 97.4%
            </Badge>
          </div>

          <div className="space-y-3">
            {[
              { label: "Quotes Requested", count: 480, pct: 100, color: "bg-[#7A2B66]" },
              { label: "Radar Offers Broadcast", count: 462, pct: 96, color: "bg-[#A74490]" },
              { label: "Captains Accepted", count: 448, pct: 93, color: "bg-[#26B896]" },
              { label: "Trips Started (PIN Verified)", count: 440, pct: 91, color: "bg-[#189578]" },
              { label: "Completed & Settled", count: 428, pct: 89, color: "bg-[#3A102F] dark:bg-[#DB99CC]" },
            ].map((step, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {step.label}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {step.count} ({step.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#211226] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${step.color} transition-all duration-500`}
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            Automated Redis candidate search with sub-second driver ranking & atomic lock assignment.
          </p>
        </div>

        {/* Operational Attention Feed */}
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Operations Attention Feed
            </h3>
            <span className="text-xs text-slate-400 font-mono">Live Sync</span>
          </div>

          <div className="space-y-3">
            {/* Alert 1 */}
            <div
              onClick={() => onNavigateToTab("kyc-queue")}
              className="rounded-xl border border-[#E9BFDF] dark:border-[#521A44] bg-[#FAF0F7]/60 dark:bg-[#331A3B]/30 p-3.5 flex items-start gap-3 cursor-pointer hover:border-[#7A2B66] transition-all"
            >
              <div className="p-2 rounded-lg bg-[#FAF0F7] dark:bg-[#331A3B] text-[#7A2B66] dark:text-[#E9BFDF]">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingKyc.length} Captain Applications Pending KYC
                  </span>
                  <span className="text-[10px] text-slate-400">12m ago</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  New applications waiting in queue (Aarav Sharma, Maya Lin) require document verification.
                </p>
              </div>
            </div>

            {/* Alert 2 */}
            <div
              onClick={() => onNavigateToTab("second-chance")}
              className="rounded-xl border border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1]/60 dark:bg-[#38110D]/30 p-3.5 flex items-start gap-3 cursor-pointer hover:border-[#F94B35] transition-all"
            >
              <div className="p-2 rounded-lg bg-[#FFF3F1] dark:bg-[#38110D] text-[#F94B35]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Second Chance Program: 1 Driver Eligible for Tier Promotion
                  </span>
                  <span className="text-[10px] text-slate-400">1h ago</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  Jimmy Carter completed 215 zero-incident rides. Eligible for graduation from Tier 1.
                </p>
              </div>
            </div>

            {/* Alert 3 */}
            <div
              onClick={() => onNavigateToTab("pricing")}
              className="rounded-xl border border-amber-200 dark:border-amber-950/60 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 flex items-start gap-3 cursor-pointer hover:border-amber-400 transition-all"
            >
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700">
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Downtown Rainey Geofence Surge Active (1.5x)
                  </span>
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  High demand triggered automated surge algorithm. Driver supply adjusting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
