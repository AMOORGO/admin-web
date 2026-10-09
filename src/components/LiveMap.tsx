"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Compass, Plus, Minus, X } from "lucide-react";
import { Badge } from "./Badge";
import { statusLabel, statusVariant, type ApiLiveCluster, type LiveMapRideView } from "@/lib/adapters/rides";
import { useEscapeKey, useFocusTrap, useScrollLock } from "@/lib/hooks/useOverlay";

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
type Selection = { kind: "ride"; id: string } | { kind: "cluster"; key: string };

const DEFAULT_CENTER: [number, number] = [30.2672, -97.7431];
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 6;
/** Zoom level from which every marker that has room gets its ref label (below it only the selected / hovered one does). */
const LABEL_ZOOM = 1.8;
const AVG_CITY_SPEED_KMH = 28;

interface Pt {
  x: number;
  y: number;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const HALO: React.CSSProperties = { paintOrder: "stroke", stroke: "var(--bg-surface)", strokeWidth: 3.5, strokeLinejoin: "round" };

export const LiveMap: React.FC<LiveMapProps> = ({ cityLabel, center, rides, clusters, onlineTotal, rideLabels, loading = false, socketLive = true, onSelectRide }) => {
  const uid = useId();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [layer, setLayer] = useState<Layer>("ALL");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const layerRootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ id: number; sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);

  // Fullscreen is a real modal layer: Esc closes it (the marker popover closes first), the page behind cannot scroll,
  // keyboard focus stays inside and returns to the toggle afterwards.
  useScrollLock(isFullScreen);
  useEscapeKey(isFullScreen, () => setIsFullScreen(false));
  useEscapeKey(selected !== null, () => setSelected(null));
  useFocusTrap(layerRootRef, isFullScreen);
  const wasFullScreen = useRef(false);
  useEffect(() => {
    if (wasFullScreen.current && !isFullScreen) toggleRef.current?.focus({ preventScroll: true });
    wasFullScreen.current = isFullScreen;
  }, [isFullScreen]);

  // The SVG viewBox always equals the canvas size, so the map fills its container at every viewport (no letterboxing).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullScreen]);

  const { w, h } = size;
  const compact = w > 0 && w < 520;
  const padX = compact ? 36 : 64;
  const padTop = 40;
  const padBottom = compact ? 72 : 64;

  // lat/lng -> fitted canvas projection (equirectangular with a cos(lat) correction), before zoom / pan
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
    const availW = Math.max(80, w - padX * 2);
    const availH = Math.max(80, h - padTop - padBottom);
    const k = Math.min(availW / spanX, availH / spanY);
    const cy = padTop + availH / 2;
    return {
      cLat,
      cLng,
      project: ([la, ln]: [number, number]): Pt => ({
        x: w / 2 + (ln - cLng) * cos * k,
        y: cy - (la - cLat) * k,
      }),
    };
  }, [rides, clusters, center, w, h, padX, padBottom]);

  /** fitted point -> on-screen point (zoom around the canvas centre + pan). */
  const toScreen = useCallback((p: Pt): Pt => ({ x: w / 2 + (p.x - w / 2) * zoom + pan.x, y: h / 2 + (p.y - h / 2) * zoom + pan.y }), [w, h, zoom, pan]);

  const rideCaptainIds = useMemo(() => new Set(rides.map((r) => r.captainId).filter((x): x is string => !!x)), [rides]);

  const showRides = layer !== "CAPTAINS";
  const showCaptains = layer !== "RIDES";
  const isEmpty = rides.length === 0 && clusters.length === 0;

  // On-screen models for every marker
  const rideModels = useMemo(
    () =>
      rides.map((ride) => {
        const a = toScreen(projection.project(ride.pickup));
        const b = toScreen(projection.project(ride.drop));
        const km = haversineKm(ride.pickup, ride.drop);
        return { key: `r:${ride.id}`, ride, a, b, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, km, etaMin: Math.max(1, Math.round((km / AVG_CITY_SPEED_KMH) * 60)) };
      }),
    [rides, projection, toScreen],
  );
  const clusterModels = useMemo(
    () =>
      clusters.map((cluster, i) => {
        const p = toScreen(projection.project([cluster.lat, cluster.lng]));
        const onTrip = !!cluster.captainIds && cluster.captainIds.length > 0 && cluster.captainIds.every((id) => rideCaptainIds.has(id));
        return { key: `c:${cluster.lat}:${cluster.lng}:${i}`, cluster, p, onTrip, r: Math.min(20, 9 + Math.sqrt(cluster.count) * 2.6) };
      }),
    [clusters, projection, toScreen, rideCaptainIds],
  );

  const selectedKey = selected ? (selected.kind === "ride" ? `r:${selected.id}` : selected.key) : null;
  const activeRide = selected?.kind === "ride" ? rideModels.find((m) => m.ride.id === selected.id) : undefined;
  const activeCluster = selected?.kind === "cluster" ? clusterModels.find((m) => m.key === selected.key) : undefined;
  const hoverRide = hoverKey && hoverKey !== selectedKey ? rideModels.find((m) => m.key === hoverKey) : undefined;
  const hoverCluster = hoverKey && hoverKey !== selectedKey ? clusterModels.find((m) => m.key === hoverKey) : undefined;

  // Label declutter: only the selected / hovered marker is labelled by default; once zoomed in, every ref that fits
  // without touching another label or marker gets one (greedy, SOS first).
  const labels = useMemo(() => {
    const out = new Map<string, { x: number; y: number; text: string }>();
    if (!showRides) return out;
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const obstacles: Array<{ key: string; x: number; y: number; r: number }> = [];
    for (const m of rideModels) {
      obstacles.push({ key: m.key, x: m.a.x, y: m.a.y, r: 9 }, { key: `${m.key}:drop`, x: m.b.x, y: m.b.y, r: 9 });
    }
    if (showCaptains) for (const c of clusterModels) obstacles.push({ key: c.key, x: c.p.x, y: c.p.y, r: c.r + 3 });
    const rectFor = (m: (typeof rideModels)[number]) => {
      const width = m.ride.ref.length * 6.2 + 8;
      return { x: m.a.x - width / 2, y: m.a.y - 28, w: width, h: 15 };
    };
    const hits = (r: { x: number; y: number; w: number; h: number }, ownKey: string) =>
      placed.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y) ||
      obstacles.some((o) => o.key !== ownKey && o.x > r.x - o.r && o.x < r.x + r.w + o.r && o.y > r.y - o.r && o.y < r.y + r.h + o.r);
    const order = [...rideModels].sort((x, y) => Number(y.key === selectedKey) - Number(x.key === selectedKey) || Number(y.ride.sos) - Number(x.ride.sos));
    for (const m of order) {
      const forced = m.key === selectedKey || m.key === hoverKey;
      if (!forced && zoom < LABEL_ZOOM) continue;
      const rect = rectFor(m);
      if (!forced && (rect.x < 4 || rect.x + rect.w > w - 4 || rect.y < 4 || hits(rect, m.key))) continue;
      placed.push(rect);
      out.set(m.key, { x: m.a.x, y: m.a.y - 16, text: m.ride.ref });
    }
    return out;
  }, [rideModels, clusterModels, showRides, showCaptains, selectedKey, hoverKey, zoom, w]);

  const zoomBy = (factor: number) => setZoom((z) => clamp(z * factor, MIN_ZOOM, MAX_ZOOM));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Ctrl/Cmd + wheel (or any wheel in fullscreen) zooms; a plain wheel over the inline map keeps scrolling the page.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!isFullScreen && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_ZOOM, MAX_ZOOM));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isFullScreen]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch" && !isFullScreen) return; // inline on touch: the page keeps scrolling
    if ((e.target as Element).closest("[data-marker]")) return;
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setPan({ x: d.px + dx, y: d.py + dy });
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (!d.moved) setSelected(null);
  };

  const markerKeys = (onActivate: () => void) => ({
    tabIndex: 0,
    role: "button" as const,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  });
  const hoverProps = (key: string) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setHoverKey(key);
    },
    onPointerLeave: () => setHoverKey((k) => (k === key ? null : k)),
    onFocus: () => setHoverKey(key),
    onBlur: () => setHoverKey((k) => (k === key ? null : k)),
  });

  const layers: Array<{ id: Layer; label: string; active: string }> = [
    { id: "ALL", label: "All", active: "bg-[#3A102F] text-white dark:bg-[#7A2B66]" },
    { id: "RIDES", label: "Rides", active: "bg-[#7A2B66] text-white" },
    { id: "CAPTAINS", label: "Captains", active: "bg-[#14755F] text-white" },
  ];

  const iconBtn =
    "flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#28162E] pointer-fine:h-9 pointer-fine:w-9";

  const rideInfo = (m: NonNullable<typeof activeRide>) => {
    const lbl = rideLabels?.[m.ride.id];
    return { lbl, route: `~${m.km.toFixed(1)} km · ~${m.etaMin} min` };
  };

  const toolbar = (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#F0E3ED] bg-white px-3 py-2.5 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] dark:border-[#331A3B] dark:bg-[#180D1C] sm:px-4">
      <div className="order-1 flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${socketLive ? "bg-[#26B896]" : "bg-amber-500"}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${socketLive ? "bg-[#26B896]" : "bg-amber-500"}`} />
          </span>
          <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">Live Fleet Radar</span>
          <span className="truncate text-xs text-slate-600 dark:text-slate-300">({cityLabel})</span>
        </span>
        <span className="flex items-center gap-2 font-mono text-xs font-semibold">
          <span className="text-[#7A2B66] dark:text-[#DB99CC]">{onlineTotal} online</span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
            |
          </span>
          <span className="text-[#14755F] dark:text-[#4FD2B2]">{rides.length} rides</span>
        </span>
      </div>

      <div className="order-3 flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <div role="group" aria-label="Map layers" className="flex items-center rounded-xl border border-[#F0E3ED] bg-slate-50 p-0.5 dark:border-[#331A3B] dark:bg-[#211226]">
          {layers.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLayer(l.id)}
              aria-pressed={layer === l.id}
              className={`min-h-10 min-w-10 rounded-lg px-3 text-xs font-semibold transition-colors pointer-fine:min-h-8 ${
                layer === l.id ? l.active : "text-slate-700 hover:text-black dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Map view" className="flex items-center gap-0.5 rounded-xl border border-[#F0E3ED] bg-slate-50 p-0.5 dark:border-[#331A3B] dark:bg-[#211226]">
          <button type="button" onClick={() => zoomBy(1.3)} className={iconBtn} aria-label="Zoom in" title="Zoom in">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.3)} className={iconBtn} aria-label="Zoom out" title="Zoom out">
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={resetView} className={iconBtn} aria-label="Reset view" title="Reset view">
            <Compass className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

      </div>

      {isFullScreen ? (
        <button
          type="button"
          data-autofocus
          onClick={() => setIsFullScreen(false)}
          className="order-2 flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#3A102F] px-3 text-xs font-bold text-white transition-colors hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490] sm:order-4"
          aria-label="Close expanded radar (Esc)"
        >
          <Minimize2 className="h-4 w-4" aria-hidden="true" />
          <span>Close</span>
        </button>
      ) : (
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setIsFullScreen(true)}
          className={`${iconBtn} order-2 shrink-0 border border-[#F0E3ED] bg-slate-50 dark:border-[#331A3B] dark:bg-[#211226] sm:order-4`}
          aria-label="Open expanded radar"
          title="Expanded live radar"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const popoverWidth = 288;
  const popoverPos = (anchor: Pt, estHeight: number) => {
    const left = clamp(anchor.x - popoverWidth / 2, 8, Math.max(8, w - popoverWidth - 8));
    const above = anchor.y - estHeight - 18;
    const top = above >= 8 ? above : clamp(anchor.y + 22, 8, Math.max(8, h - estHeight - 8));
    return { left, top };
  };

  const canvas = (
    <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-[#FAF0F7]/50 via-white to-[#EFFCF9]/40 dark:from-[#160C19] dark:via-[#1A0E1F] dark:to-[#0D1F1A]">
      {w > 0 && (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          role="group"
          aria-label={`Live fleet map for ${cityLabel}: ${rides.length} rides and ${onlineTotal} captains online`}
          className="absolute inset-0 cursor-grab select-none active:cursor-grabbing"
          style={{ touchAction: isFullScreen ? "none" : "pan-y" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
        >
          <defs>
            <pattern id={`${uid}-grid`} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x % 40} ${pan.y % 40})`}>
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-slate-200/70 dark:text-slate-800/50" />
            </pattern>
          </defs>
          <rect width={w} height={h} fill={`url(#${uid}-grid)`} />

          {/* Radar rings (decorative) */}
          <g transform={`translate(${w / 2 + pan.x}, ${h / 2 + pan.y})`} className="pointer-events-none">
            <circle r={Math.min(w, h) * 0.4} fill="none" stroke="#26B896" strokeWidth="0.8" strokeOpacity="0.22" />
            <circle r={Math.min(w, h) * 0.22} fill="none" stroke="#26B896" strokeWidth="0.8" strokeOpacity="0.18" />
            <g className="animate-radar">
              <line x1="0" y1="0" x2={Math.min(w, h) * 0.4} y2="0" stroke="#26B896" strokeWidth="1.2" strokeOpacity="0.45" />
            </g>
          </g>

          {/* Ride tracks: pickup -> drop (subtle dashes, emphasised for the selected / hovered ride) */}
          {showRides &&
            rideModels.map((m) => {
              const on = m.key === selectedKey || m.key === hoverKey;
              const onTrip = m.ride.status === "ON_TRIP";
              const color = m.ride.sos ? "#F94B35" : "#A74490";
              return (
                <g key={m.key} data-marker>
                  <line
                    x1={m.a.x}
                    y1={m.a.y}
                    x2={m.b.x}
                    y2={m.b.y}
                    stroke="transparent"
                    strokeWidth="16"
                    className="cursor-pointer"
                    onClick={() => setSelected({ kind: "ride", id: m.ride.id })}
                    {...hoverProps(m.key)}
                  />
                  <line
                    x1={m.a.x}
                    y1={m.a.y}
                    x2={m.b.x}
                    y2={m.b.y}
                    stroke={color}
                    strokeWidth={on ? 2.5 : onTrip ? 1.75 : 1.25}
                    strokeLinecap="round"
                    strokeDasharray={on ? "6 5" : "2 6"}
                    strokeOpacity={on ? 0.95 : m.ride.sos ? 0.6 : onTrip ? 0.5 : 0.32}
                    className="pointer-events-none"
                  />
                </g>
              );
            })}

          {/* Pickup / drop-off ends, each with a 32px hit area */}
          {showRides &&
            rideModels.map((m) => {
              const on = m.key === selectedKey || m.key === hoverKey;
              const act = () => setSelected({ kind: "ride", id: m.ride.id });
              return (
                <g key={`${m.key}:ends`} data-marker className="cursor-pointer outline-none" onClick={act} aria-label={`Ride ${m.ride.ref}, ${statusLabel(m.ride.rawStatus)}`} {...markerKeys(act)} {...hoverProps(m.key)}>
                  <circle cx={m.b.x} cy={m.b.y} r="16" fill="transparent" />
                  <circle cx={m.b.x} cy={m.b.y} r={on ? 6 : 4.5} fill="#189578" stroke="white" strokeWidth="1.5" />
                  <circle cx={m.a.x} cy={m.a.y} r="16" fill="transparent" />
                  <circle cx={m.a.x} cy={m.a.y} r={on ? 7 : 5} fill="#3A102F" stroke="white" strokeWidth="1.75" className="dark:fill-[#A74490]" />
                </g>
              );
            })}

          {/* Captain clusters (online captains, grid-clustered by the API) */}
          {showCaptains &&
            clusterModels.map((c) => {
              const color = c.onTrip ? "#A74490" : "#26B896";
              const on = c.key === selectedKey || c.key === hoverKey;
              const act = () => setSelected({ kind: "cluster", key: c.key });
              return (
                <g
                  key={c.key}
                  data-marker
                  transform={`translate(${c.p.x}, ${c.p.y})`}
                  className="cursor-pointer outline-none"
                  onClick={act}
                  aria-label={`${c.cluster.count} captain${c.cluster.count === 1 ? "" : "s"} ${c.onTrip ? "on trip" : "online"}`}
                  {...markerKeys(act)}
                  {...hoverProps(c.key)}
                >
                  <circle r={Math.max(16, c.r + 5)} fill="transparent" />
                  <circle r={c.r + 4} fill={color} fillOpacity={on ? 0.32 : 0.18} />
                  <circle r={c.r} fill={color} stroke="#FFFFFF" strokeWidth="2" />
                  <text y="3.5" textAnchor="middle" fill="white" className="pointer-events-none text-[10px] font-black">
                    {c.cluster.count}
                  </text>
                </g>
              );
            })}

          {/* SOS beacons (rides flagged hasSosAlert, drawn at the pickup point: the map payload has no live position) */}
          {showRides &&
            rideModels
              .filter((m) => m.ride.sos)
              .map((m) => {
                const act = () => setSelected({ kind: "ride", id: m.ride.id });
                return (
                  <g
                    key={`sos-${m.ride.id}`}
                    data-marker
                    transform={`translate(${m.a.x}, ${m.a.y})`}
                    className="cursor-pointer outline-none"
                    onClick={act}
                    aria-label={`SOS emergency on ride ${m.ride.ref}`}
                    {...markerKeys(act)}
                    {...hoverProps(m.key)}
                  >
                    <circle r="28" fill="#F94B35" fillOpacity="0.16" className="motion-safe:animate-ping" />
                    <circle r="17" fill="#F94B35" fillOpacity="0.3" />
                    <circle r="12" fill="#D93320" stroke="#FFFFFF" strokeWidth="2.5" />
                    <text x="0" y="3.5" textAnchor="middle" fill="white" className="pointer-events-none text-[8px] font-black">
                      SOS
                    </text>
                  </g>
                );
              })}

          {/* Ref labels (declutter: see `labels`), drawn last with a halo so they stay legible over lines and markers */}
          {Array.from(labels.entries()).map(([key, l]) => (
            <text
              key={`l-${key}`}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              className="pointer-events-none fill-slate-900 text-[10px] font-bold dark:fill-white"
              style={HALO}
            >
              {l.text}
            </text>
          ))}
        </svg>
      )}

      {/* Empty / loading overlay */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="rounded-xl border border-[#F0E3ED] bg-white px-4 py-3 text-center shadow-sm dark:border-[#331A3B] dark:bg-[#180D1C]">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{loading ? "Loading live fleet..." : "No active rides or online captains"}</p>
            {!loading && <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">Markers appear here as soon as captains go online.</p>}
          </div>
        </div>
      )}

      {/* Hover / focus tooltip (mouse + keyboard; touch users tap to open the popover instead) */}
      {(hoverRide || hoverCluster) && w > 0 && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 hidden w-56 rounded-lg border border-[#F0E3ED] bg-white px-3 py-2 text-[11px] shadow-xl dark:border-[#331A3B] dark:bg-[#180D1C] sm:block"
          style={{
            ...(() => {
              const anchor = hoverRide ? hoverRide.mid : hoverCluster!.p;
              const pos = popoverPos(anchor, hoverRide ? 112 : 70);
              return { left: clamp(anchor.x - 112, 8, Math.max(8, w - 232)), top: pos.top };
            })(),
          }}
        >
          {hoverRide && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-white">{hoverRide.ride.ref}</span>
                <Badge variant={statusVariant(hoverRide.ride.rawStatus)} size="sm">
                  {statusLabel(hoverRide.ride.rawStatus)}
                </Badge>
              </div>
              <p className="mt-1 truncate text-slate-600 dark:text-slate-300">Captain: {rideInfo(hoverRide).lbl ? (rideInfo(hoverRide).lbl?.captain ?? "Matching...") : hoverRide.ride.captainId ? "Assigned" : "Matching..."}</p>
              <p className="text-slate-600 dark:text-slate-300">Est. {rideInfo(hoverRide).route}</p>
              {hoverRide.ride.sos && <p className="mt-0.5 font-bold text-[#B02414] dark:text-[#FFA093]">SOS alert on this ride</p>}
            </>
          )}
          {hoverCluster && (
            <>
              <p className="font-bold text-slate-900 dark:text-white">
                {hoverCluster.cluster.count} captain{hoverCluster.cluster.count === 1 ? "" : "s"} {hoverCluster.onTrip ? "on trip" : "online"}
              </p>
              <p className="font-mono text-slate-600 dark:text-slate-300">
                {hoverCluster.cluster.lat.toFixed(4)}, {hoverCluster.cluster.lng.toFixed(4)}
              </p>
            </>
          )}
        </div>
      )}

      {/* Selected-marker card: a bottom card on phones, anchored next to the marker from sm up */}
      {(activeRide || activeCluster) && w > 0 && (
        <div
          role="dialog"
          aria-label={activeRide ? `Ride ${activeRide.ride.ref}` : "Captain cluster"}
          className="anim-pop absolute inset-x-3 bottom-3 z-30 rounded-xl border border-[#F0E3ED] bg-white p-4 shadow-2xl dark:border-[#331A3B] dark:bg-[#180D1C] sm:inset-x-auto sm:bottom-auto sm:w-72"
          style={w >= 640 ? popoverPos(activeRide ? activeRide.mid : activeCluster!.p, activeRide ? 250 : 190) : undefined}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{activeRide ? "Ride telemetry" : "Captain cluster"}</span>
              <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {activeRide ? activeRide.ride.ref : `${activeCluster!.cluster.count} captain${activeCluster!.cluster.count === 1 ? "" : "s"} online`}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close details"
              className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-[#28162E] dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {activeRide && (
            <div className="space-y-2 text-xs">
              {(() => {
                const info = rideInfo(activeRide);
                return (
                  <>
                    <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300">
                      <span>Status</span>
                      <Badge variant={statusVariant(activeRide.ride.rawStatus)} size="sm">
                        {statusLabel(activeRide.ride.rawStatus)}
                      </Badge>
                    </div>
                    {info.lbl && (
                      <>
                        <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300">
                          <span>Rider</span>
                          <span className="min-w-0 truncate font-semibold">{info.lbl.rider}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300">
                          <span>Captain</span>
                          <span className="min-w-0 truncate font-semibold">{info.lbl.captain ?? "Matching..."}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300">
                      <span>Est. route</span>
                      <span className="font-mono font-semibold">{info.route}</span>
                    </div>
                  </>
                );
              })()}
              {activeRide.ride.sos && (
                <p className="rounded-lg border border-[#FFC4BC] bg-[#FFF3F1] p-2 text-[11px] font-bold text-[#B02414] dark:border-[#61130A] dark:bg-[#38110D] dark:text-[#FFA093]">SOS alert raised on this ride</p>
              )}
              <button
                type="button"
                onClick={() => onSelectRide(activeRide.ride.id)}
                className="mt-1 min-h-10 w-full rounded-lg bg-[#3A102F] px-3 text-center text-xs font-bold text-white transition-colors hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490]"
              >
                Inspect Ride {activeRide.ride.ref}
              </button>
            </div>
          )}

          {activeCluster && (
            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span>State</span>
                <Badge variant={activeCluster.onTrip ? "plum" : "teal"} size="sm">
                  {activeCluster.onTrip ? "On trip" : "Online"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Position</span>
                <span className="font-mono">
                  {activeCluster.cluster.lat.toFixed(4)}, {activeCluster.cluster.lng.toFixed(4)}
                </span>
              </div>
              {activeCluster.cluster.captainIds && <p className="break-all font-mono text-[10px] text-slate-500 dark:text-slate-400">{activeCluster.cluster.captainIds.map((id) => id.slice(0, 8)).join(", ")}</p>}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Captains are clustered per ~1 km grid cell by the API.</p>
            </div>
          )}
        </div>
      )}

      {/* Legend (hidden on phones while a marker card is open so the two never collide) */}
      <div
        className={`pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-end justify-between gap-2 pb-[env(safe-area-inset-bottom)] ${
          selected ? "max-sm:hidden" : ""
        }`}
      >
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#F0E3ED] bg-white/95 px-3 py-1.5 text-[11px] shadow-sm dark:border-[#331A3B] dark:bg-[#180D1C]/95">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#26B896]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Online captains</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3A102F] dark:bg-[#A74490]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Pickup</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#189578]" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Drop-off</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F94B35]" />
            <span className="font-bold text-[#B02414] dark:text-[#FF7361]">SOS</span>
          </span>
        </div>

        <div className="pointer-events-auto hidden rounded-xl border border-[#F0E3ED] bg-white/95 px-3 py-1.5 font-mono text-[11px] text-slate-600 shadow-sm dark:border-[#331A3B] dark:bg-[#180D1C]/95 dark:text-slate-300 md:block">
          Lat {Math.abs(projection.cLat).toFixed(4)}° {projection.cLat >= 0 ? "N" : "S"}, Lng {Math.abs(projection.cLng).toFixed(4)}° {projection.cLng >= 0 ? "E" : "W"}
          {zoom !== 1 && <span className="ml-2 text-[#7A2B66] dark:text-[#DB99CC]">{Math.round(zoom * 100)}%</span>}
        </div>
      </div>
    </div>
  );

  const cardChrome = "overflow-hidden rounded-2xl border border-[#F0E3ED] bg-white shadow-lg dark:border-[#331A3B] dark:bg-[#180D1C]";

  if (isFullScreen && typeof document !== "undefined") {
    return (
      <>
        {/* Placeholder keeps the page layout stable while the radar is expanded */}
        <div className={`flex h-[min(70dvh,540px)] min-h-[380px] w-full items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300 ${cardChrome}`}>
          Expanded radar is open
        </div>
        {createPortal(
          <div
            ref={layerRootRef}
            role="dialog"
            aria-modal="true"
            aria-label="Expanded live radar"
            tabIndex={-1}
            className="anim-fade fixed inset-0 z-[100] flex h-dvh w-screen flex-col bg-[#FDFBFC] pt-[env(safe-area-inset-top)] text-[#1C121A] outline-none dark:bg-[#0F0811] dark:text-[#FBF8FA]"
          >
            {toolbar}
            {canvas}
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <div className={`flex h-[min(70dvh,540px)] min-h-[420px] w-full flex-col ${cardChrome}`}>
      {toolbar}
      {canvas}
    </div>
  );
};
