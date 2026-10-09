"use client";

import React, { useMemo, useState } from "react";
import { Maximize2, Minimize2, Compass } from "lucide-react";
import { Badge } from "./Badge";
import { statusLabel, statusVariant, type ApiLiveCluster, type LiveMapRideView } from "@/lib/adapters/rides";

export interface LiveMapRideLabel {
  rider: string;
  captain: string | null;
}

interface LiveMapProps {
  cityLabel: string;
  /** [lat, lng] of the selected city; used only when no ride / captain is on the map. */
  center?: [number, number] | null;
  rides: LiveMapRideView[];
  clusters: ApiLiveCluster[];
  onlineTotal: number;
  /** Optional names for the ride popup (from the rides list). */
  rideLabels?: Record<string, LiveMapRideLabel>;
  loading?: boolean;
  /** true = socket connected; false = polling fallback. */
  socketLive?: boolean;
  onSelectRide: (rideId: string) => void;
}

type Layer = "ALL" | "RIDES" | "CAPTAINS";

type ActiveMarker =
  | { type: "RIDE"; ride: LiveMapRideView; x: number; y: number }
  | { type: "CLUSTER"; cluster: ApiLiveCluster; onTrip: boolean; x: number; y: number };

const mapWidth = 900;
const mapHeight = 520;
const MARGIN = 80;
const DEFAULT_CENTER: [number, number] = [30.2672, -97.7431];

export const LiveMap: React.FC<LiveMapProps> = ({
  cityLabel,
  center,
  rides,
  clusters,
  onlineTotal,
  rideLabels,
  loading = false,
  socketLive = true,
  onSelectRide,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [layer, setLayer] = useState<Layer>("ALL");
  const [activeMarker, setActiveMarker] = useState<ActiveMarker | null>(null);

  // lat/lng -> SVG projection fitted to everything on the map (equirectangular with a cos(lat) correction)
  const projection = useMemo(() => {
    const pts: Array<[number, number]> = [];
    for (const r of rides) pts.push(r.pickup, r.drop);
    for (const c of clusters) pts.push([c.lat, c.lng]);
    const valid = pts.filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));
    if (valid.length === 0) valid.push(center ?? DEFAULT_CENTER);
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const [la, ln] of valid) {
      minLat = Math.min(minLat, la);
      maxLat = Math.max(maxLat, la);
      minLng = Math.min(minLng, ln);
      maxLng = Math.max(maxLng, ln);
    }
    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;
    const cos = Math.max(0.2, Math.cos((cLat * Math.PI) / 180));
    const spanX = Math.max(0.02, (maxLng - minLng) * cos);
    const spanY = Math.max(0.02, maxLat - minLat);
    const k = Math.min((mapWidth - MARGIN * 2) / spanX, (mapHeight - MARGIN * 2) / spanY);
    return {
      cLat,
      cLng,
      project: ([la, ln]: [number, number]) => ({
        x: mapWidth / 2 + (ln - cLng) * cos * k,
        y: mapHeight / 2 - (la - cLat) * k,
      }),
    };
  }, [rides, clusters, center]);

  const rideCaptainIds = useMemo(() => new Set(rides.map((r) => r.captainId).filter((x): x is string => !!x)), [rides]);

  const showRides = layer !== "CAPTAINS";
  const showCaptains = layer !== "RIDES";
  const isEmpty = rides.length === 0 && clusters.length === 0;
  const layers: Array<{ id: Layer; label: string; active: string }> = [
    { id: "ALL", label: "All", active: "bg-[#3A102F] text-white" },
    { id: "RIDES", label: "Rides", active: "bg-[#7A2B66] text-white" },
    { id: "CAPTAINS", label: "Captains", active: "bg-[#189578] text-white" },
  ];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-gradient-to-br from-[#FAF0F7]/40 via-white to-[#EFFCF9]/30 dark:from-[#160C19] dark:via-[#1A0E1F] dark:to-[#0D1F1A] shadow-lg transition-all ${
        isFullScreen ? "fixed inset-4 z-50 rounded-2xl" : "h-[540px] w-full"
      }`}
    >
      {/* Map Control Bar Top */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-xl bg-white/90 dark:bg-[#180D1C]/90 px-3.5 py-2 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] shadow-sm">
            <span className={`flex h-2.5 w-2.5 rounded-full ${socketLive ? "bg-[#26B896] animate-ping" : "bg-amber-500"}`} />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Live Fleet Radar ({cityLabel})</span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-mono font-semibold text-[#7A2B66] dark:text-[#DB99CC]">{onlineTotal} online</span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-mono font-semibold text-[#189578]">{rides.length} rides</span>
          </div>

          <div className="flex items-center rounded-xl bg-white/90 dark:bg-[#180D1C]/90 p-1 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] shadow-sm">
            {layers.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayer(l.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  layer === l.id ? l.active : "text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
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
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="w-full h-full flex items-center justify-center transition-transform duration-300" style={{ transform: `scale(${zoom})` }}>
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full select-none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-slate-200/50 dark:text-slate-800/40" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width={mapWidth} height={mapHeight} fill="url(#grid)" onClick={() => setActiveMarker(null)} />

          {/* Radar rings in the centre (decorative) */}
          <g transform={`translate(${mapWidth / 2}, ${mapHeight / 2})`} className="pointer-events-none">
            <circle r="180" fill="none" stroke="#26B896" strokeWidth="0.8" strokeOpacity="0.25" />
            <circle r="100" fill="none" stroke="#26B896" strokeWidth="0.8" strokeOpacity="0.2" />
            <line x1="0" y1="0" x2="180" y2="0" stroke="#26B896" strokeWidth="1.5" strokeOpacity="0.6" className="animate-radar origin-center" />
          </g>

          {/* Active ride tracks: pickup -> drop */}
          {showRides &&
            rides.map((ride) => {
              const a = projection.project(ride.pickup);
              const b = projection.project(ride.drop);
              const onTrip = ride.status === "ON_TRIP";
              return (
                <g
                  key={ride.id}
                  className="cursor-pointer"
                  onClick={() => setActiveMarker({ type: "RIDE", ride, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })}
                >
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="14" />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={ride.sos ? "#F94B35" : "#A74490"}
                    strokeWidth={onTrip ? 4 : 2.5}
                    strokeLinecap="round"
                    strokeDasharray="8 6"
                    className={onTrip ? "animate-pulse" : ""}
                    strokeOpacity={onTrip ? 1 : 0.7}
                  />
                  <circle cx={a.x} cy={a.y} r="6" fill="#3A102F" stroke="white" strokeWidth="2" />
                  <circle cx={b.x} cy={b.y} r="6" fill="#189578" stroke="white" strokeWidth="2" />
                  <text x={a.x} y={a.y - 11} textAnchor="middle" className="text-[9px] font-bold fill-slate-800 dark:fill-white pointer-events-none">
                    {ride.ref}
                  </text>
                </g>
              );
            })}

          {/* Captain clusters (online captains, grid-clustered by the API) */}
          {showCaptains &&
            clusters.map((c, i) => {
              const { x, y } = projection.project([c.lat, c.lng]);
              const onTrip = !!c.captainIds && c.captainIds.length > 0 && c.captainIds.every((id) => rideCaptainIds.has(id));
              const color = onTrip ? "#A74490" : "#26B896";
              const r = Math.min(22, 9 + Math.sqrt(c.count) * 3);
              return (
                <g
                  key={`${c.lat}:${c.lng}:${i}`}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer transition-transform duration-500 hover:scale-125"
                  onClick={() => setActiveMarker({ type: "CLUSTER", cluster: c, onTrip, x, y })}
                >
                  <circle r={r + 5} fill={color} fillOpacity="0.2" className={onTrip ? "animate-pulse" : ""} />
                  <circle r={r} fill={color} stroke="#FFFFFF" strokeWidth="2" />
                  <text y="3.5" textAnchor="middle" fill="white" className="text-[10px] font-black pointer-events-none">
                    {c.count}
                  </text>
                </g>
              );
            })}

          {/* SOS beacons (rides flagged hasSosAlert, drawn at the pickup point: the map payload has no live position) */}
          {rides
            .filter((r) => r.sos)
            .map((r) => {
              const { x, y } = projection.project(r.pickup);
              return (
                <g
                  key={`sos-${r.id}`}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onClick={() => setActiveMarker({ type: "RIDE", ride: r, x, y })}
                >
                  <circle r="36" fill="#F94B35" fillOpacity="0.25" className="animate-ping" />
                  <circle r="20" fill="#F94B35" fillOpacity="0.4" className="animate-pulse" />
                  <circle r="12" fill="#D93320" stroke="#FFFFFF" strokeWidth="2.5" />
                  <text x="0" y="4" textAnchor="middle" fill="white" className="text-[9px] font-black pointer-events-none">
                    SOS
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {/* Empty / loading overlay */}
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="rounded-xl bg-white/90 dark:bg-[#180D1C]/90 border border-[#F0E3ED] dark:border-[#331A3B] px-4 py-3 text-center shadow-sm">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{loading ? "Loading live fleet..." : "No active rides or online captains"}</p>
            {!loading && <p className="text-[11px] text-slate-400 mt-0.5">Markers appear here as soon as captains go online.</p>}
          </div>
        </div>
      )}

      {/* Floating Marker Card on click */}
      {activeMarker && (
        <div
          className="absolute z-30 w-72 rounded-xl bg-white dark:bg-[#180D1C] p-4 border border-[#F0E3ED] dark:border-[#331A3B] shadow-2xl animate-in zoom-in-95 duration-150"
          style={{
            left: `clamp(8px, calc(${(activeMarker.x / mapWidth) * 100}% - 144px), calc(100% - 296px))`,
            top: `clamp(60px, calc(${(activeMarker.y / mapHeight) * 100}% - 150px), calc(100% - 230px))`,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{activeMarker.type === "RIDE" ? "RIDE TELEMETRY" : "CAPTAIN CLUSTER"}</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeMarker.type === "RIDE" ? activeMarker.ride.ref : `${activeMarker.cluster.count} captain${activeMarker.cluster.count === 1 ? "" : "s"} online`}
              </h4>
            </div>
            <button onClick={() => setActiveMarker(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold">
              ✕
            </button>
          </div>

          {activeMarker.type === "RIDE" && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>Status:</span>
                <Badge variant={statusVariant(activeMarker.ride.rawStatus)} size="sm">
                  {statusLabel(activeMarker.ride.rawStatus)}
                </Badge>
              </div>
              {rideLabels?.[activeMarker.ride.id] && (
                <>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Rider:</span>
                    <span className="font-semibold">{rideLabels[activeMarker.ride.id].rider}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Captain:</span>
                    <span className="font-semibold">{rideLabels[activeMarker.ride.id].captain ?? "Matching..."}</span>
                  </div>
                </>
              )}
              {activeMarker.ride.sos && (
                <p className="p-2 rounded-lg bg-[#FFF3F1] dark:bg-[#38110D] border border-[#FFC4BC] dark:border-[#61130A] text-[11px] font-bold text-[#B02414] dark:text-[#FFA093]">
                  SOS alert raised on this ride
                </p>
              )}
              <button
                onClick={() => onSelectRide(activeMarker.ride.id)}
                className="w-full mt-2 rounded-lg bg-[#3A102F] hover:bg-[#521A44] text-white py-1.5 text-xs font-bold transition-all text-center"
              >
                Inspect Ride {activeMarker.ride.ref}
              </button>
            </div>
          )}

          {activeMarker.type === "CLUSTER" && (
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span>State:</span>
                <Badge variant={activeMarker.onTrip ? "plum" : "teal"} size="sm">
                  {activeMarker.onTrip ? "On trip" : "Online"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Position:</span>
                <span className="font-mono">
                  {activeMarker.cluster.lat.toFixed(4)}, {activeMarker.cluster.lng.toFixed(4)}
                </span>
              </div>
              {activeMarker.cluster.captainIds && (
                <p className="text-[10px] font-mono text-slate-400 break-all">{activeMarker.cluster.captainIds.map((id) => id.slice(0, 8)).join(", ")}</p>
              )}
              <p className="text-[11px] text-slate-400">Captains are clustered per ~1 km grid cell by the API.</p>
            </div>
          )}
        </div>
      )}

      {/* Legend Bottom Bar */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-3 rounded-xl bg-white/90 dark:bg-[#180D1C]/90 px-3 py-1.5 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] text-[11px] shadow-sm pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#26B896]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Online Captains</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3A102F] dark:bg-[#A74490]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Pickup</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#189578]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Drop-off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F94B35]" />
            <span className="font-medium text-[#F94B35] font-bold">SOS Emergency</span>
          </div>
        </div>

        <div className="rounded-xl bg-white/90 dark:bg-[#180D1C]/90 px-3 py-1.5 backdrop-blur-md border border-[#F0E3ED] dark:border-[#331A3B] text-[11px] font-mono text-slate-500 shadow-sm pointer-events-auto">
          <span>
            Lat: {Math.abs(projection.cLat).toFixed(4)}° {projection.cLat >= 0 ? "N" : "S"}, Lng: {Math.abs(projection.cLng).toFixed(4)}° {projection.cLng >= 0 ? "E" : "W"}
          </span>
        </div>
      </div>
    </div>
  );
};
