"use client";

import React, { useMemo, useState } from "react";
import { DollarSign, History, Calculator, Save } from "lucide-react";
import { Badge, BadgeVariant } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import {
  ApiCityFull,
  ApiFarePreview,
  ApiPricingRule,
  ApiServiceType,
  RuleForm,
  formToRuleParams,
  localToIso,
  resolveActiveRule,
  ruleToForm,
  sameForm,
} from "@/lib/adapters/pricing";
import { BTN_GHOST, BTN_PRIMARY, CARD, INPUT, NumField } from "./shared";

interface FaresPanelProps {
  city: ApiCityFull;
  serviceType: ApiServiceType;
}

type RuleState = "LIVE" | "SCHEDULED" | "ENDED" | "INACTIVE";
const stateVariant: Record<RuleState, BadgeVariant> = { LIVE: "teal", SCHEDULED: "plum", ENDED: "neutral", INACTIVE: "warning" };

export const FaresPanel: React.FC<FaresPanelProps> = ({ city, serviceType }) => {
  const rules = useQuery<{ items: ApiPricingRule[]; at: number }>(`pricing-rules:${city.id}:${serviceType.id}`, async (signal) => {
    const p = await api.getPage<ApiPricingRule>("/admin/pricing/rules", { query: { cityId: city.id, serviceTypeId: serviceType.id, limit: 100 }, signal });
    // "now" is the fetch time so a version published a moment ago counts as live
    return { items: p.items, at: Date.now() };
  });
  useOnInvalidate("config", rules.refetch);

  if (rules.error && !rules.data) return <ErrorBanner error={rules.error} title="Could not load pricing rules" onRetry={rules.refetch} />;
  if (rules.initialLoading || !rules.data) {
    return (
      <div className={`${CARD} space-y-4`}>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const now = rules.data.at;
  const versions = [...rules.data.items].sort((a, b) => b.version - a.version);
  const active = resolveActiveRule(versions, now);
  const base = active ?? versions[0] ?? null;

  return (
    <div className="space-y-6">
      <RuleEditor key={`${city.id}:${serviceType.id}:${base?.id ?? "new"}`} city={city} serviceType={serviceType} baseline={base} isLive={active !== null} />
      <VersionHistory versions={versions} now={now} serviceType={serviceType} />
    </div>
  );
};

// ───────────────────────────── Rate matrix editor ─────────────────────────────

const RuleEditor: React.FC<{ city: ApiCityFull; serviceType: ApiServiceType; baseline: ApiPricingRule | null; isLive: boolean }> = ({
  city,
  serviceType,
  baseline,
  isLive,
}) => {
  const toast = useToast();
  const { can } = useAuth();
  const baseForm = useMemo(() => ruleToForm(baseline), [baseline]);
  const [form, setForm] = useState<RuleForm>(baseForm);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const unit = city.distanceUnit === "KM" ? "km" : "mile";
  const dirty = !sameForm(form, baseForm) || effectiveFrom !== "" || effectiveTo !== "";
  const canSave = baseline === null || dirty;
  const canEdit = can("config.edit");
  const set = (k: keyof RuleForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (reason: string) => {
    const body = {
      cityId: city.id,
      serviceTypeId: serviceType.id,
      reason,
      ...formToRuleParams(form),
      ...(effectiveFrom ? { effectiveFrom: localToIso(effectiveFrom) } : {}),
      ...(effectiveTo ? { effectiveTo: localToIso(effectiveTo) } : {}),
    };
    const created = await api.post<ApiPricingRule>("/admin/pricing/rules", body);
    toast.success(`Published ${serviceType.name} pricing v${created.version} for ${city.name}`);
    setConfirm(false);
    invalidate("config");
  };

  return (
    <div className={`${CARD} space-y-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-[#331A3B] pb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-[#7A2B66] dark:text-[#DB99CC]" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Fare Rate Matrix: {city.name} / {serviceType.name} ({city.currency})
          </h2>
          {baseline && (
            <Badge variant={isLive ? "teal" : "warning"} size="sm">
              {isLive ? `v${baseline.version} live` : `v${baseline.version} not live`}
            </Badge>
          )}
        </div>
        <Can permission="config.edit">
          <button type="button" onClick={() => setConfirm(true)} disabled={!canSave} className={BTN_PRIMARY}>
            <Save className="h-4 w-4" />
            {baseline ? "Publish New Version" : "Create First Version"}
          </button>
        </Can>
      </div>

      {!baseline && (
        <p className="rounded-xl bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-300">
          No pricing rule exists for this service type in {city.name}. Riders cannot get quotes for it until a first version is published.
        </p>
      )}
      <Can
        permission="config.edit"
        fallback={<p className="text-xs text-slate-500 dark:text-slate-400">You can view pricing but not change it (requires config.edit).</p>}
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Rules are versioned: saving publishes a new version that applies immediately to new quotes; rides already priced keep the version they were quoted with.
        </p>
      </Can>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <NumField disabled={!canEdit} label="Base Pickup Fare ($)" value={form.baseFare} onChange={set("baseFare")} step="0.25" hint="Fixed flag-drop charge" />
          <NumField disabled={!canEdit} label={`Distance Rate ($ / ${unit})`} value={form.perDistance} onChange={set("perDistance")} step="0.05" hint="Metered GPS snapped rate" />
          <NumField disabled={!canEdit} label="Time Rate ($ / minute)" value={form.perMinute} onChange={set("perMinute")} step="0.01" hint="Traffic & waiting duration" />
          <NumField disabled={!canEdit} label="Minimum Floor Fare ($)" value={form.minimumFare} onChange={set("minimumFare")} step="0.5" hint="Minimum guaranteed charge (>= base fare)" />
          <NumField disabled={!canEdit} label="Booking Fee ($)" value={form.bookingFee} onChange={set("bookingFee")} step="0.05" hint="Service fee shown to the rider" />
          <NumField disabled={!canEdit} label="Waiting Rate ($ / minute)" value={form.waitingPerMinute} onChange={set("waitingPerMinute")} step="0.01" hint={`After ${form.waitingFreeMinutes} free minutes`} />
          <NumField disabled={!canEdit} label="Sales Tax (%)" value={form.taxPercent} onChange={set("taxPercent")} step="0.05" hint="Shown separately on the receipt" />
          <NumField disabled={!canEdit} label="Platform Commission (%)" value={form.commissionPercent} onChange={set("commissionPercent")} step="0.5" hint="Platform take rate" tone="font-bold text-[#14755F] dark:text-[#4FD2B2]" />
          <NumField disabled={!canEdit} label="Maximum Surge Multiplier Cap (x)" value={form.surgeCap} onChange={set("surgeCap")} step="0.1" min="1" hint="Hard cap on any surge (1.0 - 10.0)" tone="font-bold text-[#D93320] dark:text-[#FF7361]" />
      </div>

      <div>
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs font-semibold text-[#7A2B66] dark:text-[#DB99CC] hover:underline">
          {showAdvanced ? "Hide advanced" : "Show advanced (waiting, rounding, quote validity, schedule)"}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <NumField disabled={!canEdit} label="Free Waiting (minutes)" value={form.waitingFreeMinutes} onChange={set("waitingFreeMinutes")} step="1" />
            <NumField disabled={!canEdit} label="Rounding Increment (minor units)" value={form.roundingIncrementMinor} onChange={set("roundingIncrementMinor")} step="1" min="1" hint="Fixed amounts must be multiples of this" />
            <NumField disabled={!canEdit} label="Quote Validity (seconds)" value={form.quoteTtlSeconds} onChange={set("quoteTtlSeconds")} step="30" hint="30 - 1800" />
            <NumField disabled={!canEdit} label="Max Fare Tolerance (%)" value={form.maxFareTolerancePct} onChange={set("maxFareTolerancePct")} step="1" hint="Final fare cap vs quote" />
            <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B] sm:col-span-2">
              <label className="font-bold text-slate-700 dark:text-slate-200">Effective From (optional)</label>
              <input type="datetime-local" disabled={!canEdit} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={INPUT} />
              <span className="text-xs text-slate-500 dark:text-slate-400">Empty = effective immediately. A later date schedules the version.</span>
            </div>
            <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B] sm:col-span-2">
              <label className="font-bold text-slate-700 dark:text-slate-200">Effective Until (optional)</label>
              <input type="datetime-local" disabled={!canEdit} value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className={INPUT} />
              <span className="text-xs text-slate-500 dark:text-slate-400">Afterwards the next-highest version applies again.</span>
            </div>
          </div>
        )}
      </div>

      <FarePreview city={city} serviceType={serviceType} form={form} unit={unit} />

      <ConfirmDialog
        isOpen={confirm}
        title="Publish New Pricing Version"
        description={`This publishes a new rate version for ${serviceType.name} in ${city.name} and immediately changes fare calculations and passenger quote estimations.`}
        targetEntityLabel={`${city.name} / ${serviceType.code}`}
        confirmText="Publish New Rate Version"
        isDestructive={false}
        requireReason={true}
        reasonPlaceholder="Specify economic or operational justification for pricing adjustments..."
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
};

// ───────────────────────────── Fare preview ─────────────────────────────

const FarePreview: React.FC<{ city: ApiCityFull; serviceType: ApiServiceType; form: RuleForm; unit: string }> = ({ city, serviceType, form, unit }) => {
  const [distance, setDistance] = useState("5");
  const [minutes, setMinutes] = useState("12");
  const [surge, setSurge] = useState("1.0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiFarePreview | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      const out = await api.post<ApiFarePreview>("/admin/pricing/preview", {
        cityId: city.id,
        serviceTypeId: serviceType.id,
        draft: formToRuleParams(form),
        distanceInUnit: Number.parseFloat(distance) || 0,
        durationMinutes: Number.parseFloat(minutes) || 0,
        surgeMultiplierBps: Math.round((Number.parseFloat(surge) || 1) * 10_000),
      });
      setResult(out);
    } catch (e) {
      setResult(null);
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const b = result?.breakdown;
  const m = (minor: number) => formatMoney(minor, city.currency);
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] bg-slate-50/60 dark:bg-[#211226]/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Fare Preview (uses the values above, nothing is saved)</h3>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="space-y-1">
          <span className="block font-semibold text-slate-600 dark:text-slate-300">Distance ({unit}s)</span>
          <input type="number" min="0" step="0.5" value={distance} onChange={(e) => setDistance(e.target.value)} className={`${INPUT} w-28`} />
        </label>
        <label className="space-y-1">
          <span className="block font-semibold text-slate-600 dark:text-slate-300">Duration (min)</span>
          <input type="number" min="0" step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${INPUT} w-28`} />
        </label>
        <label className="space-y-1">
          <span className="block font-semibold text-slate-600 dark:text-slate-300">Surge (x)</span>
          <input type="number" min="1" step="0.1" value={surge} onChange={(e) => setSurge(e.target.value)} className={`${INPUT} w-24`} />
        </label>
        <button type="button" onClick={run} disabled={pending} className="rounded-xl bg-[#3A102F] px-4 py-2 text-xs font-bold text-white hover:bg-[#521A44] disabled:opacity-50">
          {pending ? "Calculating…" : "Preview fare"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-medium text-[#D93320] dark:text-[#FF7361] break-words">{error}</p>}
      {b && result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            ["Base", b.baseFareMinor],
            ["Distance", b.distanceFareMinor],
            ["Time", b.timeFareMinor],
            ["Waiting", b.waitingFareMinor],
            [b.minimumFareApplied ? "Subtotal (minimum applied)" : "Subtotal", b.subtotalMinor],
            [`Surge ${(b.surgeMultiplierBps / 10_000).toFixed(2)}x`, b.surgeMinor],
            ["Booking fee", b.bookingFeeMinor],
            ["Tax", b.taxMinor],
            ["Platform commission", b.platformCommissionMinor],
            ["Captain earning", b.captainEarningMinor],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-white dark:bg-[#180D1C] border border-slate-100 dark:border-[#331A3B] p-2.5">
              <span className="text-xs uppercase text-slate-500 dark:text-slate-400">{label}</span>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{m(Number(value))}</p>
            </div>
          ))}
          <div className="rounded-xl bg-[#EFFCF9] dark:bg-[#0D2620] p-2.5">
            <span className="text-xs uppercase text-slate-500 dark:text-slate-400">Rider total</span>
            <p className="font-mono font-black text-[#14755F] dark:text-[#82E5CB] mt-0.5">{m(result.totalMinor)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ───────────────────────────── Version history ─────────────────────────────

const VersionHistory: React.FC<{ versions: ApiPricingRule[]; now: number; serviceType: ApiServiceType }> = ({ versions, now, serviceType }) => {
  const toast = useToast();
  const [target, setTarget] = useState<ApiPricingRule | null>(null);
  const live = resolveActiveRule(versions, now);

  const stateOf = (r: ApiPricingRule): RuleState => {
    if (!r.isActive) return "INACTIVE";
    if (new Date(r.effectiveFrom).getTime() > now) return "SCHEDULED";
    if (r.effectiveTo && new Date(r.effectiveTo).getTime() <= now) return "ENDED";
    return "LIVE";
  };

  const toggle = async (reason: string) => {
    if (!target) return;
    await api.patch(`/admin/pricing/rules/${target.id}`, { isActive: !target.isActive, reason });
    toast.success(`Version ${target.version} ${target.isActive ? "deactivated" : "activated"}`);
    setTarget(null);
    invalidate("config");
  };

  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-[#7A2B66]" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Version History: {serviceType.name}</h2>
      </div>
      {versions.length === 0 ? (
        <EmptyState title="No versions yet" description="Publish the first version above." />
      ) : (
        <div className="data-table-container sticky-first">
          <table className="w-full min-w-[45rem] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
                <th className="py-2 px-3">Version</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Base / Distance / Time / Min</th>
                <th className="py-2 px-3">Commission / Cap</th>
                <th className="py-2 px-3">Effective</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {versions.map((r) => {
                const st = stateOf(r);
                return (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-mono font-bold">v{r.version}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant={stateVariant[st]} size="sm">
                        {live?.id === r.id ? "LIVE (resolved)" : st}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {formatMoney(r.baseFareMinor, r.currency)} / {formatMoney(r.perDistanceUnitMinor, r.currency)} / {formatMoney(r.perMinuteMinor, r.currency)} / {formatMoney(r.minimumFareMinor, r.currency)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {(r.commissionBps / 100).toFixed(1)}% / {(r.surgeCapBps / 10_000).toFixed(1)}x
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {formatDateTime(r.effectiveFrom)}
                      {r.effectiveTo ? ` → ${formatDateTime(r.effectiveTo)}` : ""}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Can permission="config.edit">
                        <button type="button" onClick={() => setTarget(r)} className={BTN_GHOST}>
                          {r.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </Can>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        isOpen={target !== null}
        title={target?.isActive ? "Deactivate Pricing Version" : "Activate Pricing Version"}
        description={
          target?.isActive
            ? "If no other version is in force, riders will not be able to get quotes for this service type in this city."
            : "The highest effective version that is active will be used for new quotes."
        }
        targetEntityLabel={target ? `${serviceType.code} v${target.version}` : undefined}
        confirmText={target?.isActive ? "Deactivate" : "Activate"}
        isDestructive={target?.isActive ?? false}
        requireReason={true}
        onConfirm={toggle}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
};
