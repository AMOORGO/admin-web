"use client";

import React, { useState, useEffect } from "react";
import {
  Navigation,
  Car,
  AlertOctagon,
  Maximize2,
  Minimize2,
  RefreshCw,
  Layers,
  MapPin,
  Compass,
  Zap,
} from "lucide-react";
import { Captain, Ride, SOSIncident } from "@/types";
import { Badge } from "./Badge";

interface LiveMapProps {
  captains: Captain[];
  activeRides: Ride[];
  sosIncidents: SOSIncident[];
  selectedCity: string;
  onSelectRide: (ride: Ride) => void;
  onSelectCaptain?: (captain: Captain) => void;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  captains,
  activeRides,
  sosIncidents,
  selectedCity,
  onSelectRide,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | "AVAILABLE" | "ON_TRIP">("ALL");
  const [activeMarker, setActiveMarker] = useState<{
    type: "CAPTAIN" | "RIDE" | "SOS";
    data: any;
    x: number;
    y: number;
  } | null>(null);

  // Simulated GPS movement ticks
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => (prev + 1) % 100);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Map coordinates projection for city view
  const mapWidth = 900;
  const mapHeight = 520;

  // Visual simulation coordinates
  const simulatedCaptains = captains.map((c, idx) => {
    const angle = (idx * 55 + tick * 3) % 360;
    const rad = (angle * Math.PI) / 180;
    const baseRadius = 120 + (idx % 3) * 60;
    const cx = mapWidth / 2 + Math.cos(rad) * baseRadius + (idx % 2 === 0 ? 30 : -30);
    const cy = mapHeight / 2 + Math.sin(rad) * (baseRadius * 0.7);
    return {
      ...c,
      x: Math.max(60, Math.min(mapWidth - 60, cx)),
      y: Math.max(60, Math.min(mapHeight - 60, cy)),
    };
  });

  const filteredCaptains = simulatedCaptains.filter((c) => {
    if (filterType === "AVAILABLE") return c.status === "ACTIVE";
    if (filterType === "ON_TRIP") return c.status === "ON_TRIP";
    return true;
  });

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-gradient-to-br from-[#FAF0F7]/40 via-white to-[#EFFCF9]/30 dark:from-[#160C19] dark:via-[#1A0E1F] dark:to-[#0D1F1A] shadow-lg transition-all ${
        isFullScreen ? "fixed inset-4 z-50 rounded-2xl" : "h-[540px] w-full"
      }`}
    >
      {/* Map Control Bar Top */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-xl bg-white/90 dark:bg-[#180D1C]/90 px-3.5 py-2 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] shadow-sm">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#26B896] animate-ping" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Live Fleet Radar ({selectedCity})
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-mono font-semibold text-[#7A2B66] dark:text-[#DB99CC]">
              {filteredCaptains.length} online
            </span>
          </div>

          <div className="flex items-center rounded-xl bg-white/90 dark:bg-[#180D1C]/90 p-1 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] shadow-sm">
            <button
              onClick={() => setFilterType("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                filterType === "ALL"
                  ? "bg-[#3A102F] text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("AVAILABLE")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                filterType === "AVAILABLE"
                  ? "bg-[#189578] text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-[#189578]"
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setFilterType("ON_TRIP")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                filterType === "ON_TRIP"
                  ? "bg-[#7A2B66] text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-[#7A2B66]"
              }`}
            >
              On Trip
            </button>
          </div>
        </div>

        {/* Right Map Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 rounded-xl bg-white/90 dark:bg-[#180D1C]/90 p-1 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] shadow-sm">
            <button
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#28162E] font-bold text-sm"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#28162E] font-bold text-sm"
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={() => setZoom(1)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              title="Reset View"
            >
              <Compass className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              title="Toggle Fullscreen"
            >
              {isFullScreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-300"
        style={{ transform: `scale(${zoom})` }}
      >
        <svg
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          className="w-full h-full select-none"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                className="text-slate-200/50 dark:text-slate-800/40"
              />
            </pattern>
            {/* Radar Beam Gradient */}
            <linearGradient id="radarBeam" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#26B896" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#26B896" stopOpacity="0.0" />
            </linearGradient>
            {/* High Demand Geofence Gradient */}
            <radialGradient id="surgeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F94B35" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F94B35" stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Grid background */}
          <rect width={mapWidth} height={mapHeight} fill="url(#grid)" />

          {/* City River (Lady Bird Lake / River stylized path) */}
          <path
            d="M -20 280 Q 200 240, 380 290 T 700 270 T 940 320"
            fill="none"
            stroke="#B4F2E1"
            strokeWidth="32"
            strokeLinecap="round"
            className="opacity-40 dark:opacity-20"
          />
          <path
            d="M -20 280 Q 200 240, 380 290 T 700 270 T 940 320"
            fill="none"
            stroke="#82E5CB"
            strokeWidth="14"
            strokeLinecap="round"
            className="opacity-60 dark:opacity-30"
          />

          {/* Major Highways & Arterials */}
          {/* I-35 Corridor */}
          <line
            x1="520"
            y1="-20"
            x2="480"
            y2="540"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-300 dark:text-slate-700/60"
          />
          <line
            x1="520"
            y1="-20"
            x2="480"
            y2="540"
            stroke="#F5E2F0"
            strokeWidth="3"
            strokeDasharray="8 6"
            className="opacity-80 dark:opacity-40"
          />

          {/* Loop 1 / MoPac Expressway */}
          <line
            x1="220"
            y1="-20"
            x2="260"
            y2="540"
            stroke="currentColor"
            strokeWidth="6"
            className="text-slate-300 dark:text-slate-700/50"
          />

          {/* Cross avenues */}
          <line
            x1="-20"
            y1="160"
            x2="920"
            y2="180"
            stroke="currentColor"
            strokeWidth="4"
            className="text-slate-300 dark:text-slate-800"
          />
          <line
            x1="-20"
            y1="380"
            x2="920"
            y2="410"
            stroke="currentColor"
            strokeWidth="5"
            className="text-slate-300 dark:text-slate-800"
          />

          {/* Geofence Zones */}
          {/* Downtown High Demand Zone */}
          <g>
            <circle cx="450" cy="220" r="110" fill="url(#surgeGlow)" />
            <polygon
              points="360,160 540,160 560,280 340,270"
              fill="rgba(167, 68, 144, 0.08)"
              stroke="#7A2B66"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x="450"
              y="180"
              textAnchor="middle"
              className="text-[10px] font-bold fill-[#7A2B66] dark:fill-[#E9BFDF] tracking-wider"
            >
              ZONE A: DOWNTOWN (1.5x SURGE)
            </text>
          </g>

          {/* Airport Zone */}
          <g>
            <rect
              x="680"
              y="320"
              width="180"
              height="140"
              rx="16"
              fill="rgba(38, 184, 150, 0.06)"
              stroke="#26B896"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x="770"
              y="350"
              textAnchor="middle"
              className="text-[10px] font-bold fill-[#14755F] dark:fill-[#82E5CB] tracking-wider"
            >
              AIRPORT ZONE (AUS)
            </text>
          </g>

          {/* Active Trip Polyline (Ride 101: Congress to Airport) */}
          <g>
            <path
              d="M 450 210 Q 560 250, 640 310 T 770 380"
              fill="none"
              stroke="#A74490"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="8 6"
              className="animate-pulse"
            />
            {/* Pickup Pin */}
            <circle cx="450" cy="210" r="7" fill="#3A102F" stroke="white" strokeWidth="2" />
            <text x="450" y="198" textAnchor="middle" className="text-[9px] font-bold fill-slate-800 dark:fill-white">
              Pickup (Congress)
            </text>

            {/* Dropoff Pin */}
            <circle cx="770" cy="380" r="7" fill="#189578" stroke="white" strokeWidth="2" />
            <text x="770" y="405" textAnchor="middle" className="text-[9px] font-bold fill-slate-800 dark:fill-white">
              Airport Terminal
            </text>
          </g>

          {/* Radar Sweep Effect in Center */}
          <g transform={`translate(${mapWidth / 2}, ${mapHeight / 2})`}>
            <circle r="180" fill="none" stroke="#26B896" strokeWidth="0.8" strokeOpacity="0.25" />
            <circle r="100" fill="none" stroke="#26B896" strokeWidth="0.8" strokeOpacity="0.2" />
            <line
              x1="0"
              y1="0"
              x2="180"
              y2="0"
              stroke="#26B896"
              strokeWidth="1.5"
              strokeOpacity="0.6"
              className="animate-radar origin-center"
            />
          </g>

          {/* Captain Markers */}
          {filteredCaptains.map((cap) => {
            const isAvailable = cap.status === "ACTIVE";
            const isOnTrip = cap.status === "ON_TRIP";
            const markerColor = isAvailable ? "#26B896" : "#A74490";

            return (
              <g
                key={cap.id}
                transform={`translate(${cap.x}, ${cap.y})`}
                className="cursor-pointer transition-transform duration-500 hover:scale-125"
                onClick={() =>
                  setActiveMarker({
                    type: "CAPTAIN",
                    data: cap,
                    x: cap.x,
                    y: cap.y,
                  })
                }
              >
                {/* Aura pulse */}
                <circle
                  r="14"
                  fill={markerColor}
                  fillOpacity="0.2"
                  className={isOnTrip ? "animate-pulse" : ""}
                />
                {/* Vehicle circle */}
                <circle
                  r="9"
                  fill={markerColor}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="shadow-md"
                />
                {/* Direction indicator */}
                <path
                  d="M 0 -7 L 4 3 L -4 3 Z"
                  fill="#FFFFFF"
                  transform={`rotate(${(tick * 20 + parseInt(cap.id.slice(-1))) % 360})`}
                />

                {/* Plate / Name tag */}
                <text
                  x="0"
                  y="18"
                  textAnchor="middle"
                  className="text-[9px] font-semibold fill-slate-800 dark:fill-slate-200 pointer-events-none drop-shadow"
                >
                  {cap.name.split(" ")[0]} ({cap.vehicle.plateNumber.split("-")[1]})
                </text>
              </g>
            );
          })}

          {/* SOS Incident Marker (Critical Alert Beacon) */}
          {sosIncidents
            .filter((s) => s.status === "ACTIVE")
            .map((sos) => {
              const sx = 320;
              const sy = 140;
              return (
                <g
                  key={sos.id}
                  transform={`translate(${sx}, ${sy})`}
                  className="cursor-pointer"
                  onClick={() =>
                    setActiveMarker({
                      type: "SOS",
                      data: sos,
                      x: sx,
                      y: sy,
                    })
                  }
                >
                  <circle r="36" fill="#F94B35" fillOpacity="0.25" className="animate-ping" />
                  <circle r="20" fill="#F94B35" fillOpacity="0.4" className="animate-pulse" />
                  <circle r="12" fill="#D93320" stroke="#FFFFFF" strokeWidth="2.5" />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="white"
                    className="text-[9px] font-black pointer-events-none"
                  >
                    SOS
                  </text>
                  <text
                    x="0"
                    y="-18"
                    textAnchor="middle"
                    className="text-[10px] font-black fill-[#F94B35] tracking-wider animate-pulse"
                  >
                    EMERGENCY IN PROGRESS
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {/* Floating Marker Card on click */}
      {activeMarker && (
        <div
          className="absolute z-30 w-72 rounded-xl bg-white dark:bg-[#180D1C] p-4 border border-[#F0E3ED] dark:border-[#331A3B] shadow-2xl animate-in zoom-in-95 duration-150"
          style={{
            left: Math.min(mapWidth - 300, Math.max(20, activeMarker.x - 140)),
            top: Math.min(mapHeight - 200, Math.max(60, activeMarker.y - 120)),
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {activeMarker.type} TELEMETRY
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeMarker.type === "CAPTAIN"
                  ? activeMarker.data.name
                  : activeMarker.type === "SOS"
                  ? `SOS #${activeMarker.data.id}`
                  : "Active Trip"}
              </h4>
            </div>
            <button
              onClick={() => setActiveMarker(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>

          {activeMarker.type === "CAPTAIN" && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Vehicle:</span>
                <span className="font-semibold">{activeMarker.data.vehicle.make} {activeMarker.data.vehicle.model}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Plate:</span>
                <span className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">{activeMarker.data.vehicle.plateNumber}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Rating:</span>
                <span className="font-semibold text-amber-500">★ {activeMarker.data.rating}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Status:</span>
                <Badge
                  variant={activeMarker.data.status === "ACTIVE" ? "teal" : "plum"}
                  size="sm"
                >
                  {activeMarker.data.status}
                </Badge>
              </div>

              {activeMarker.data.status === "ON_TRIP" && (
                <button
                  onClick={() => {
                    const match = activeRides.find((r) => r.captain?.id === activeMarker.data.id);
                    if (match) onSelectRide(match);
                  }}
                  className="w-full mt-2 rounded-lg bg-[#3A102F] hover:bg-[#521A44] text-white py-1.5 text-xs font-bold transition-all text-center"
                >
                  Inspect Active Ride (#AG-9021)
                </button>
              )}
            </div>
          )}

          {activeMarker.type === "SOS" && (
            <div className="space-y-2 text-xs">
              <div className="p-2 rounded-lg bg-[#FFF3F1] dark:bg-[#38110D] border border-[#FFC4BC] dark:border-[#61130A] text-[#B02414] dark:text-[#FFA093]">
                <p className="font-bold">Triggered by Rider: {activeMarker.data.userName}</p>
                <p className="text-[11px]">Speed: {activeMarker.data.speedKmh} km/h • Battery: {activeMarker.data.batteryLevel}%</p>
              </div>
              <p className="text-[11px] text-slate-500">SLA Timer: {activeMarker.data.slaSecondsLeft}s remaining</p>
            </div>
          )}
        </div>
      )}

      {/* Legend Bottom Bar */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-3 rounded-xl bg-white/90 dark:bg-[#180D1C]/90 px-3 py-1.5 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] text-[11px] shadow-sm pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#26B896]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Available Captain</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#A74490]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">On Active Trip</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F94B35]" />
            <span className="font-medium text-[#F94B35] font-bold">SOS Emergency</span>
          </div>
        </div>

        <div className="rounded-xl bg-white/90 dark:bg-[#180D1C]/90 px-3 py-1.5 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] text-[11px] font-mono text-slate-500 shadow-sm pointer-events-auto">
          <span>Lat: 30.2672° N, Lng: -97.7431° W</span>
        </div>
      </div>
    </div>
  );
};
