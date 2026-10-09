"use client";

import React, { useState } from "react";
import { api, fetchAllPages } from "@/lib/api";
import { useCities } from "@/lib/cities/CityProvider";
import { useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { ApiCityFull, ApiServiceType } from "@/lib/adapters/pricing";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, SectionTabs } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Building2, Layers, Power, Banknote } from "lucide-react";
import { ConfigPanel } from "@/lib/pricing/ConfigPanel";
import { FaresPanel } from "@/lib/pricing/FaresPanel";
import { CityControlsCard, PolicyCard } from "@/lib/pricing/CityCards";
import { SurgeCard } from "@/lib/pricing/SurgeCard";
import { ZonesPanel } from "@/lib/pricing/ZonesPanel";

type PricingTab = "FARES" | "ZONES" | "CONFIG";

export const PricingConfigView: React.FC = () => {
  const cityCtx = useCities();
  const [tab, setTab] = useState<PricingTab>("FARES");
  const [cityPick, setCityPick] = useState<string | null>(null);
  const [serviceTypePick, setServiceTypePick] = useState<string | null>(null);

  const cities = useQuery<ApiCityFull[]>("pricing-cities", (signal) => fetchAllPages<ApiCityFull>("/admin/cities", { signal }));
  const serviceTypes = useQuery<ApiServiceType[]>("pricing-service-types", (signal) => api.get<ApiServiceType[]>("/admin/service-types", { signal }));
  const { refetch: refetchShellCities } = cityCtx;
  useOnInvalidate("config", () => {
    cities.refetch();
    serviceTypes.refetch();
    refetchShellCities();
  });

  const cityList = cities.data ?? [];
  const typeList = (serviceTypes.data ?? []).filter((s) => s.isActive);
  const city = cityList.find((c) => c.id === cityPick) ?? cityList.find((c) => c.id === cityCtx.selectedCityId) ?? cityList[0] ?? null;
  const serviceType = typeList.find((s) => s.id === serviceTypePick) ?? typeList[0] ?? null;

  const pill = (active: boolean) =>
    `min-h-10 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
      active
        ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
        : "border border-slate-200 bg-white text-slate-700 hover:border-[#7A2B66] dark:border-[#331A3B] dark:bg-[#180D1C] dark:text-slate-300"
    }`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Pricing, Dynamic Surge & Geofencing"
        description="Configure city-specific base fares, mileage rates, surge pricing, service boundaries, feature flags and platform settings"
      />

      <StatGrid cols={4}>
        <StatCard label="Cities" icon={Building2} tone="brand" loading={cities.initialLoading} value={String(cityList.length)} hint={`${cityList.filter((c) => c.isActive).length} active`} />
        <StatCard label="Accepting rides" icon={Power} tone="good" loading={cities.initialLoading} value={String(cityList.filter((c) => c.ridesEnabled).length)} hint={cityList.some((c) => !c.ridesEnabled) ? `${cityList.filter((c) => !c.ridesEnabled).length} paused` : "All cities live"} />
        <StatCard label="Service types" icon={Layers} tone="info" loading={serviceTypes.initialLoading} value={String(typeList.length)} hint="Active products" />
        <StatCard label="Cash enabled" icon={Banknote} tone="warn" loading={cities.initialLoading} value={`${cityList.filter((c) => c.cashEnabled).length} of ${cityList.length}`} hint="Cities taking cash rides" />
      </StatGrid>

      {/* City Picker */}
      {tab !== "CONFIG" && cityList.length > 0 && (
        <div role="group" aria-label="City" className="flex flex-wrap items-center gap-2">
          {cityList.map((c) => (
            <button key={c.id} type="button" onClick={() => setCityPick(c.id)} aria-pressed={city?.id === c.id} className={pill(city?.id === c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <SectionTabs
        label="Pricing sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: "FARES", label: "Fares, Cancellation & Surge" },
          { id: "ZONES", label: "Zones & Geofencing" },
          { id: "CONFIG", label: "Feature Flags & Platform Config" },
        ]}
      />

      {cities.error && !cities.data && <ErrorBanner error={cities.error} title="Could not load cities" onRetry={cities.refetch} />}
      {serviceTypes.error && !serviceTypes.data && <ErrorBanner error={serviceTypes.error} title="Could not load service types" onRetry={serviceTypes.refetch} />}

      {cities.initialLoading || serviceTypes.initialLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : tab === "CONFIG" ? (
        <ConfigPanel cities={cityList} />
      ) : !city ? (
        <EmptyState title="No cities configured" description="Create a city before configuring pricing and zones." />
      ) : tab === "ZONES" ? (
        <ZonesPanel key={city.id} city={city} />
      ) : !serviceType ? (
        <EmptyState title="No active service types" description="Service types are managed by an unscoped administrator." />
      ) : (
        <div className="space-y-6">
          <div role="group" aria-label="Ride type" className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Ride type</span>
            {typeList.map((s) => {
              const enabled = s.enabledCityIds.includes(city.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setServiceTypePick(s.id)}
                  title={enabled ? undefined : `${s.name} is not enabled in ${city.name}`}
                  className={`${pill(serviceType.id === s.id)} ${enabled ? "" : "opacity-60"}`}
                >
                  {s.name}
                  {!enabled && " (off)"}
                </button>
              );
            })}
          </div>

          <FaresPanel city={city} serviceType={serviceType} />
          <SurgeCard city={city} serviceTypes={typeList} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PolicyCard city={city} serviceType={serviceType} />
            <CityControlsCard city={city} />
          </div>
        </div>
      )}
    </div>
  );
};
