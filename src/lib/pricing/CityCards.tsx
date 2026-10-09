"use client";

import React, { useMemo, useState } from "react";
import { MapPin, Power, Save, Ban } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { majorToMinor, minorToMajor } from "@/lib/format";
import { useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import {
  ApiCancellationPolicy,
  ApiCityFull,
  ApiServiceType,
  PolicyForm,
  formToPolicyBody,
  policyToForm,
  samePolicyForm,
} from "@/lib/adapters/pricing";
import { BTN_PRIMARY, CARD, FIELD_BOX, INPUT, NumField, SELECT, Toggle } from "./shared";

// ───────────────────────────── Cancellation policy ─────────────────────────────

export const PolicyCard: React.FC<{ city: ApiCityFull; serviceType: ApiServiceType }> = ({ city, serviceType }) => {
  const policies = useQuery<ApiCancellationPolicy[]>(`cancel-policies:${city.id}`, async (signal) => {
    const p = await api.getPage<ApiCancellationPolicy>("/admin/pricing/cancellation-policies", { query: { cityId: city.id, limit: 100 }, signal });
    return p.items;
  });
  useOnInvalidate("config", policies.refetch);
  const [scopeOverride, setScopeOverride] = useState<"DEFAULT" | "SERVICE" | null>(null);

  if (policies.error && !policies.data) return <ErrorBanner error={policies.error} title="Could not load cancellation policies" onRetry={policies.refetch} />;
  if (!policies.data) {
    return (
      <div className={`${CARD} space-y-3`}>
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const specific = policies.data.find((p) => p.serviceTypeId === serviceType.id) ?? null;
  const fallback = policies.data.find((p) => p.serviceTypeId === null) ?? null;
  const scope = scopeOverride ?? (specific ? "SERVICE" : "DEFAULT");
  const baseline = scope === "SERVICE" ? specific : fallback;

  return (
    <PolicyEditor
      key={`${city.id}:${scope}:${serviceType.id}:${baseline?.id ?? "new"}:${baseline ? JSON.stringify(policyToForm(baseline)) : ""}`}
      city={city}
      serviceType={serviceType}
      baseline={baseline}
      scope={scope}
      onScope={setScopeOverride}
      inheritsDefault={scope === "SERVICE" && !specific && fallback !== null}
    />
  );
};

const PolicyEditor: React.FC<{
  city: ApiCityFull;
  serviceType: ApiServiceType;
  baseline: ApiCancellationPolicy | null;
  scope: "DEFAULT" | "SERVICE";
  onScope: (s: "DEFAULT" | "SERVICE") => void;
  inheritsDefault: boolean;
}> = ({ city, serviceType, baseline, scope, onScope, inheritsDefault }) => {
  const toast = useToast();
  const { can } = useAuth();
  const baseForm = useMemo(() => policyToForm(baseline), [baseline]);
  const [form, setForm] = useState<PolicyForm>(baseForm);
  const [confirm, setConfirm] = useState(false);
  const canEdit = can("config.edit");
  const dirty = !samePolicyForm(form, baseForm);
  const set = (k: keyof PolicyForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (reason: string) => {
    await api.put("/admin/pricing/cancellation-policies", {
      cityId: city.id,
      serviceTypeId: scope === "SERVICE" ? serviceType.id : null,
      reason,
      ...formToPolicyBody(form),
    });
    toast.success(`Cancellation policy saved for ${city.name}`);
    setConfirm(false);
    invalidate("config");
  };

  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-[#D93320] dark:text-[#FF7361]" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Cancellation Policy</h2>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Policy scope" value={scope} onChange={(e) => onScope(e.target.value as "DEFAULT" | "SERVICE")} className={SELECT}>
            <option value="DEFAULT">City default (all ride types)</option>
            <option value="SERVICE">{serviceType.name} only</option>
          </select>
          <Can permission="config.edit">
            <button type="button" onClick={() => setConfirm(true)} disabled={baseline !== null && !dirty} className={BTN_PRIMARY}>
              <Save className="h-4 w-4" /> Save
            </button>
          </Can>
        </div>
      </div>
      {inheritsDefault && (
        <p className="text-xs text-slate-500 dark:text-slate-400">No {serviceType.name}-specific policy yet: it currently uses the city default. Saving here creates an override.</p>
      )}
      {!baseline && !inheritsDefault && <p className="text-xs text-amber-700 dark:text-amber-300">No policy exists for this scope yet. Saving creates it.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <NumField disabled={!canEdit} label="Free Cancel Window (seconds)" value={form.freeCancelSeconds} onChange={set("freeCancelSeconds")} step="10" hint="After a captain is assigned" />
        <NumField disabled={!canEdit} label="Fee After Assignment ($)" value={form.feeAfterAssignment} onChange={set("feeAfterAssignment")} step="0.5" hint="Cancellation fee once the window passed" />
        <NumField disabled={!canEdit} label="Fee After Arrival ($)" value={form.feeAfterArrival} onChange={set("feeAfterArrival")} step="0.5" />
        <NumField disabled={!canEdit} label="No-Show Fee ($)" value={form.noShowFee} onChange={set("noShowFee")} step="0.5" />
        <NumField disabled={!canEdit} label="No-Show Grace (seconds)" value={form.noShowGraceSeconds} onChange={set("noShowGraceSeconds")} step="30" hint="Captain waits this long first" />
        <NumField disabled={!canEdit} label="Captain Share of Fees (%)" value={form.captainSharePercent} onChange={set("captainSharePercent")} step="1" />
        <NumField disabled={!canEdit} label="Captain Cancel Window (days)" value={form.captainCancelWindowDays} onChange={set("captainCancelWindowDays")} step="1" min="1" />
        <NumField disabled={!canEdit} label="Captain Warn / Review At" value={form.captainCancelWarnThreshold} onChange={set("captainCancelWarnThreshold")} step="1" min="1" hint={`Warn after N cancellations, review after ${form.captainCancelReviewThreshold}`} />
        <NumField disabled={!canEdit} label="Captain Review Threshold" value={form.captainCancelReviewThreshold} onChange={set("captainCancelReviewThreshold")} step="1" min="1" />
        <div className={`${FIELD_BOX} flex items-center justify-between`}>
          <span className="font-bold text-slate-700 dark:text-slate-200">Policy active</span>
          <Toggle label="Policy active" checked={form.isActive} disabled={!canEdit} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirm}
        title="Save Cancellation Policy"
        description={`Updates the cancellation and no-show fees for ${scope === "SERVICE" ? serviceType.name : "all ride types"} in ${city.name}. New cancellations use the new values immediately.`}
        targetEntityLabel={`${city.name} / ${scope === "SERVICE" ? serviceType.code : "default"}`}
        confirmText="Save Policy"
        isDestructive={false}
        requireReason={true}
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
};

// ───────────────────────────── City controls ─────────────────────────────

export const CityControlsCard: React.FC<{ city: ApiCityFull }> = ({ city }) => {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("config.edit");
  const [fee, setFee] = useState(minorToMajor(city.settings?.airportFeeMinor ?? 0).toFixed(2));
  const [feeConfirm, setFeeConfirm] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const savedFee = minorToMajor(city.settings?.airportFeeMinor ?? 0).toFixed(2);

  const saveFee = async (reason: string) => {
    await api.patch(`/admin/cities/${city.id}`, { reason, settings: { ...(city.settings ?? {}), airportFeeMinor: majorToMinor(Number.parseFloat(fee) || 0) } });
    toast.success(`Airport facility fee updated for ${city.name}`);
    setFeeConfirm(false);
    invalidate("config");
  };

  const toggleRides = async (reason: string) => {
    await api.post(`/admin/cities/${city.id}/rides-enabled`, { enabled: !city.ridesEnabled, reason, ...(city.ridesEnabled && message.trim() ? { message: message.trim() } : {}) });
    toast.success(city.ridesEnabled ? `New rides paused in ${city.name}` : `Rides resumed in ${city.name}`);
    setSwitchConfirm(false);
    setMessage("");
    invalidate("config");
  };

  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[#7A2B66]" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">City Controls: {city.name}</h2>
      </div>

      <div className={`${FIELD_BOX} flex items-center justify-between gap-3`}>
        <div>
          <p className="font-bold text-slate-700 dark:text-slate-200 text-xs flex items-center gap-2">
            <Power className="h-3.5 w-3.5" /> Accepting new rides
            <Badge variant={city.ridesEnabled ? "teal" : "coral"} size="sm">
              {city.ridesEnabled ? "ON" : "PAUSED"}
            </Badge>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Temporary shutdown switch: new requests are refused with a message; rides already in progress are not touched.
            {!city.ridesEnabled && city.shutdownMessage ? ` Message: "${city.shutdownMessage}"` : ""}
          </p>
        </div>
        <Can permission="config.edit">
          <Toggle label="Accepting new rides" checked={city.ridesEnabled} onChange={() => setSwitchConfirm(true)} />
        </Can>
      </div>

      <div className={FIELD_BOX}>
        <label className="font-bold text-slate-700 dark:text-slate-200 text-xs">Airport Facility Fee ({city.currency})</label>
        <div className="flex items-center gap-2">
          <input type="number" step="0.5" min="0" value={fee} disabled={!canEdit} onChange={(e) => setFee(e.target.value)} className={INPUT} />
          <Can permission="config.edit">
            <button type="button" onClick={() => setFeeConfirm(true)} disabled={fee === savedFee} className={BTN_PRIMARY}>
              <Save className="h-4 w-4" /> Save
            </button>
          </Can>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">Pass-through fee added to trips that start or end in an Airport zone (untaxed, paid to the captain).</span>
      </div>

      <ConfirmDialog
        isOpen={feeConfirm}
        title="Update Airport Facility Fee"
        description={`Sets the pass-through airport fee for ${city.name} to $${(Number.parseFloat(fee) || 0).toFixed(2)}.`}
        targetEntityLabel={city.name}
        confirmText="Save Fee"
        isDestructive={false}
        requireReason={true}
        onConfirm={saveFee}
        onCancel={() => setFeeConfirm(false)}
      />
      <ConfirmDialog
        isOpen={switchConfirm}
        title={city.ridesEnabled ? "Pause New Rides" : "Resume Rides"}
        description={
          city.ridesEnabled
            ? `Riders in ${city.name} will not be able to request new rides until you resume. Rides already in flight continue.`
            : `Riders in ${city.name} will be able to request rides again.`
        }
        targetEntityLabel={city.name}
        confirmText={city.ridesEnabled ? "Pause Rides" : "Resume Rides"}
        isDestructive={city.ridesEnabled}
        requireReason={true}
        onConfirm={toggleRides}
        onCancel={() => setSwitchConfirm(false)}
      >
        {city.ridesEnabled && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Message shown to riders (optional)</label>
            <input
              value={message}
              maxLength={300}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="We are temporarily unavailable in your area."
              className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2.5 text-sm dark:text-white"
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
