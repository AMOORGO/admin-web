"use client";

import React, { useState } from "react";
import { api, fetchAllPages } from "@/lib/api";
import { useCities } from "@/lib/cities/CityProvider";
import { useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { ApiCityFull, ApiServiceType } from "@/lib/adapters/pricing";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
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

  const tabClass = (t: PricingTab) =>
    `pb-3 border-b-2 transition-all whitespace-nowrap ${
      tab === t
        ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
    }`;
  const pill = (active: boolean) =>
    `rounded-xl px-4 py-2 text-xs font-bold transition-all ${
      active
        ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
        : "bg-white dark:bg-[#180D1C] border border-slate-200 dark:border-[#331A3B] text-slate-600 dark:text-slate-300 hover:border-[#7A2B66]"
    }`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Pricing, Dynamic Surge & Geofencing</h1>
          <p className="text-xs text-slate-500">
            Configure city-specific base fares, mileage rates, surge pricing, service boundaries, feature flags and platform settings
          </p>
        </div>

        {/* City Picker */}
        {tab !== "CONFIG" && (
          <div className="flex flex-wrap items-center gap-2">
            {cityList.map((c) => (
              <button key={c.id} onClick={() => setCityPick(c.id)} className={pill(city?.id === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex border-b border-[#F0E3ED] dark:border-[#331A3B] gap-6 text-xs font-bold overflow-x-auto">
        <button onClick={() => setTab("FARES")} className={tabClass("FARES")}>
          Fares, Cancellation & Surge
        </button>
        <button onClick={() => setTab("ZONES")} className={tabClass("ZONES")}>
          Zones & Geofencing
        </button>
        <button onClick={() => setTab("CONFIG")} className={tabClass("CONFIG")}>
          Feature Flags & Platform Config
        </button>
      </div>

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Ride type</span>
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
