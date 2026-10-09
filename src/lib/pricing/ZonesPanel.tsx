"use client";

import React, { useMemo, useState } from "react";
import { Layers, Plus, Pencil, Trash2, Power } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardsSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { ApiCityFull, ApiZone, ZONE_TYPES, ZoneTypeValue, bboxToPolygon, toGeofenceZone } from "@/lib/adapters/pricing";
import { humanize } from "@/lib/format";
import { BTN_GHOST, BTN_PLUM, INPUT, SELECT, Toggle } from "./shared";
import { useZones } from "./useGeo";

interface ZoneForm {
  name: string;
  type: ZoneTypeValue;
  surge: string;
  minLat: string;
  minLng: string;
  maxLat: string;
  maxLng: string;
  allowPickup: boolean;
  allowDropoff: boolean;
  isActive: boolean;
}

const formFromZone = (z: ApiZone): ZoneForm => ({
  name: z.name,
  type: z.type,
  surge: String(z.surgeMultiplierBps / 10_000),
  minLat: String(z.bboxMinLat),
  minLng: String(z.bboxMinLng),
  maxLat: String(z.bboxMaxLat),
  maxLng: String(z.bboxMaxLng),
  allowPickup: z.allowPickup,
  allowDropoff: z.allowDropoff,
  isActive: z.isActive,
});

const defaultForm = (city: ApiCityFull): ZoneForm => ({
  name: "",
  type: "STANDARD",
  surge: "1",
  minLat: (city.centerLat - 0.05).toFixed(4),
  minLng: (city.centerLng - 0.05).toFixed(4),
  maxLat: (city.centerLat + 0.05).toFixed(4),
  maxLng: (city.centerLng + 0.05).toFixed(4),
  allowPickup: true,
  allowDropoff: true,
  isActive: true,
});

export const ZonesPanel: React.FC<{ city: ApiCityFull }> = ({ city }) => {
  const toast = useToast();
  const zones = useZones(city.id);
  const [editing, setEditing] = useState<{ zone: ApiZone | null } | null>(null);
  const [form, setForm] = useState<ZoneForm>(() => defaultForm(city));
  const [deleteTarget, setDeleteTarget] = useState<ApiZone | null>(null);
  const [rideTarget, setRideTarget] = useState<ApiZone | null>(null);
  const [message, setMessage] = useState("");

  const views = useMemo(() => (zones.data ?? []).map((z) => ({ api: z, view: toGeofenceZone(z, () => city.name) })), [zones.data, city.name]);

  const openCreate = () => {
    setForm(defaultForm(city));
    setEditing({ zone: null });
  };
  const openEdit = (z: ApiZone) => {
    setForm(formFromZone(z));
    setEditing({ zone: z });
  };
  const set = <K extends keyof ZoneForm>(k: K, v: ZoneForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (reason: string) => {
    if (!editing) return;
    const minLat = Number.parseFloat(form.minLat);
    const minLng = Number.parseFloat(form.minLng);
    const maxLat = Number.parseFloat(form.maxLat);
    const maxLng = Number.parseFloat(form.maxLng);
    const common = {
      name: form.name.trim(),
      type: form.type,
      surgeMultiplierBps: Math.round((Number.parseFloat(form.surge) || 1) * 10_000),
      isActive: form.isActive,
      allowPickup: form.allowPickup,
      allowDropoff: form.allowDropoff,
      reason,
    };
    const polygon = bboxToPolygon(minLat, minLng, maxLat, maxLng);
    if (editing.zone) {
      const z = editing.zone;
      const bboxChanged = minLat !== z.bboxMinLat || minLng !== z.bboxMinLng || maxLat !== z.bboxMaxLat || maxLng !== z.bboxMaxLng;
      await api.patch(`/admin/zones/${z.id}`, { ...common, ...(bboxChanged ? { polygon } : {}) });
      toast.success(`Zone "${common.name}" updated`);
    } else {
      await api.post("/admin/zones", { ...common, cityId: city.id, polygon });
      toast.success(`Zone "${common.name}" created`);
    }
    setEditing(null);
    invalidate("config");
  };

  const removeZone = async (reason: string) => {
    if (!deleteTarget) return;
    await api.delete(`/admin/zones/${deleteTarget.id}`, { query: { reason } });
    toast.success(`Zone "${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
    invalidate("config");
  };

  const toggleRides = async (reason: string) => {
    if (!rideTarget) return;
    const enable = !rideTarget.ridesEnabled;
    await api.post(`/admin/zones/${rideTarget.id}/rides-enabled`, { enabled: enable, reason, ...(rideTarget.ridesEnabled && message.trim() ? { message: message.trim() } : {}) });
    toast.success(enable ? `Rides resumed in ${rideTarget.name}` : `New rides paused in ${rideTarget.name}`);
    setRideTarget(null);
    setMessage("");
    invalidate("config");
  };

  const bboxValid = [form.minLat, form.minLng, form.maxLat, form.maxLng].every((v) => Number.isFinite(Number.parseFloat(v)));
  const valid = form.name.trim().length > 0 && bboxValid && Number.parseFloat(form.surge) >= 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#7A2B66]" />
          Configured Geofence Zones ({zones.data?.length ?? 0})
        </h2>
        <Can permission="config.edit">
          <button type="button" onClick={openCreate} className={`${BTN_PLUM} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" /> New zone
          </button>
        </Can>
      </div>

      {zones.error && <ErrorBanner error={zones.error} title="Could not load zones" onRetry={zones.refetch} />}
      {zones.initialLoading ? (
        <CardsSkeleton count={4} />
      ) : views.length === 0 && !zones.error ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
          <EmptyState title={`No zones in ${city.name}`} description="Create a service zone to define where rides can start and end." icon={Layers} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {views.map(({ api: z, view }) => (
            <div key={z.id} className="rounded-2xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white break-words">{view.name}</h4>
                  <span className="text-[10px] text-slate-400">{view.city}</span>
                </div>
                <Badge variant={view.type === "HIGH_DEMAND" ? "coral" : view.type === "AIRPORT" ? "teal" : "plum"} size="sm">
                  {humanize(view.type)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#211226]">
                  <span className="text-[10px] text-slate-400">Standing Surge</span>
                  <p className="font-mono font-bold text-[#F94B35] mt-0.5">{view.surgeFactor.toFixed(2)}x</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#211226]">
                  <span className="text-[10px] text-slate-400">Rides</span>
                  <p className={`font-bold mt-0.5 ${view.ridesEnabled ? "text-emerald-600" : "text-rose-600"}`}>{view.ridesEnabled ? "Enabled" : "Paused"}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {z.bboxMinLat.toFixed(3)}, {z.bboxMinLng.toFixed(3)} → {z.bboxMaxLat.toFixed(3)}, {z.bboxMaxLng.toFixed(3)}
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {!view.isActive && <Badge variant="warning" size="sm">Inactive</Badge>}
                {!view.allowPickup && <Badge variant="neutral" size="sm">No pickup</Badge>}
                {!view.allowDropoff && <Badge variant="neutral" size="sm">No drop-off</Badge>}
              </div>
              {!view.ridesEnabled && view.shutdownMessage && <p className="text-[10px] italic text-slate-500">&quot;{view.shutdownMessage}&quot;</p>}

              <Can permission="config.edit">
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-[#331A3B]">
                  <button type="button" onClick={() => openEdit(z)} className={`${BTN_GHOST} inline-flex items-center gap-1`}>
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button type="button" onClick={() => { setMessage(""); setRideTarget(z); }} className={`${BTN_GHOST} inline-flex items-center gap-1`}>
                    <Power className="h-3 w-3" /> {z.ridesEnabled ? "Pause" : "Resume"}
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(z)} className={`${BTN_GHOST} inline-flex items-center gap-1 text-rose-600`} aria-label={`Delete ${z.name}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </Can>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={editing !== null}
        title={editing?.zone ? "Edit Zone" : "New Zone"}
        description={
          editing?.zone
            ? "Changes apply to new quotes and ride requests immediately. Changing the bounding box replaces the zone polygon with that rectangle."
            : `Creates a rectangular service zone inside ${city.name}. Coordinates are latitude / longitude of the south-west and north-east corners.`
        }
        targetEntityLabel={editing?.zone?.name ?? city.name}
        confirmText={editing?.zone ? "Save Zone" : "Create Zone"}
        isDestructive={false}
        requireReason={true}
        confirmDisabled={!valid}
        onConfirm={save}
        onCancel={() => setEditing(null)}
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="col-span-2 space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Name</span>
            <input value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} className={`${INPUT} font-sans`} />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Type</span>
            <select value={form.type} onChange={(e) => set("type", e.target.value as ZoneTypeValue)} className={`${SELECT} w-full`}>
              {ZONE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Standing surge (x, 1.0 - 5.0)</span>
            <input type="number" min="1" max="5" step="0.1" value={form.surge} onChange={(e) => set("surge", e.target.value)} className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">South lat</span>
            <input type="number" step="0.0001" value={form.minLat} onChange={(e) => set("minLat", e.target.value)} className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">West lng</span>
            <input type="number" step="0.0001" value={form.minLng} onChange={(e) => set("minLng", e.target.value)} className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">North lat</span>
            <input type="number" step="0.0001" value={form.maxLat} onChange={(e) => set("maxLat", e.target.value)} className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">East lng</span>
            <input type="number" step="0.0001" value={form.maxLng} onChange={(e) => set("maxLng", e.target.value)} className={INPUT} />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
              <Toggle label="Allow pickup" checked={form.allowPickup} onChange={(v) => set("allowPickup", v)} /> Pickup
            </label>
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
              <Toggle label="Allow drop-off" checked={form.allowDropoff} onChange={(v) => set("allowDropoff", v)} /> Drop-off
            </label>
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
              <Toggle label="Zone active" checked={form.isActive} onChange={(v) => set("isActive", v)} /> Active
            </label>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Zone"
        description="Deleting a zone removes its geofence and any surge rules attached to it. This cannot be undone."
        targetEntityLabel={deleteTarget?.name}
        confirmText="Delete Zone"
        isDestructive={true}
        requireReason={true}
        onConfirm={removeZone}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={rideTarget !== null}
        title={rideTarget?.ridesEnabled ? "Pause Rides in Zone" : "Resume Rides in Zone"}
        description={
          rideTarget?.ridesEnabled
            ? "New ride requests starting here are refused with your message; rides already in progress are not touched."
            : "New ride requests are accepted in this zone again."
        }
        targetEntityLabel={rideTarget?.name}
        confirmText={rideTarget?.ridesEnabled ? "Pause Rides" : "Resume Rides"}
        isDestructive={rideTarget?.ridesEnabled ?? false}
        requireReason={true}
        onConfirm={toggleRides}
        onCancel={() => setRideTarget(null)}
      >
        {rideTarget?.ridesEnabled && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Message shown to riders (optional)</label>
            <input
              value={message}
              maxLength={300}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Pickups are paused here temporarily."
              className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2.5 text-sm dark:text-white"
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
