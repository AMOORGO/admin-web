"use client";

import React, { useState } from "react";
import {
  Settings2,
  DollarSign,
  Zap,
  MapPin,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Save,
  Layers,
} from "lucide-react";
import { CityPricingConfig, GeofenceZone, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface PricingConfigViewProps {
  configs: CityPricingConfig[];
  geofences: GeofenceZone[];
  role: StaffRole;
  onSavePricing: (updatedConfig: CityPricingConfig, reason: string) => void;
}

export const PricingConfigView: React.FC<PricingConfigViewProps> = ({
  configs,
  geofences,
  role,
  onSavePricing,
}) => {
  const [selectedCity, setSelectedCity] = useState(configs[0].city);
  const currentConfig = configs.find((c) => c.city === selectedCity) || configs[0];

  const [formData, setFormData] = useState<CityPricingConfig>(currentConfig);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    const target = configs.find((c) => c.city === city) || configs[0];
    setFormData(target);
    setHasUnsavedChanges(false);
  };

  const handleFieldChange = (key: keyof CityPricingConfig, value: any) => {
    setFormData({ ...formData, [key]: value });
    setHasUnsavedChanges(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Pricing, Dynamic Surge & Geofencing
          </h1>
          <p className="text-xs text-slate-500">
            Configure city-specific base fares, mileage rates, automated surge algorithms, and service boundaries
          </p>
        </div>

        {/* City Picker */}
        <div className="flex items-center gap-2">
          {configs.map((c) => (
            <button
              key={c.city}
              onClick={() => handleCityChange(c.city)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                selectedCity === c.city
                  ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
                  : "bg-white dark:bg-[#180D1C] border border-slate-200 dark:border-[#331A3B] text-slate-600 dark:text-slate-300 hover:border-[#7A2B66]"
              }`}
            >
              {c.city}
            </button>
          ))}
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="rounded-3xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#331A3B] pb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#7A2B66] dark:text-[#DB99CC]" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Fare Rate Matrix: {formData.city} ({formData.currency})
            </h2>
          </div>

          <Can role={role} permission="config.edit">
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={!hasUnsavedChanges}
              className="rounded-xl bg-[#189578] hover:bg-[#14755F] text-white px-5 py-2 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-2 shadow-sm"
            >
              <Save className="h-4 w-4" />
              Save Rate Matrix
            </button>
          </Can>
        </div>

        {/* Grid Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Base Pickup Fare ($)
            </label>
            <input
              type="number"
              step="0.25"
              value={formData.baseFare}
              onChange={(e) => handleFieldChange("baseFare", parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white"
            />
            <span className="text-[10px] text-slate-400">Fixed flag-drop charge</span>
          </div>

          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Distance Rate ($ / mile)
            </label>
            <input
              type="number"
              step="0.05"
              value={formData.perKmRate}
              onChange={(e) => handleFieldChange("perKmRate", parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white"
            />
            <span className="text-[10px] text-slate-400">Metered GPS snapped rate</span>
          </div>

          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Time Rate ($ / minute)
            </label>
            <input
              type="number"
              step="0.02"
              value={formData.perMinuteRate}
              onChange={(e) => handleFieldChange("perMinuteRate", parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white"
            />
            <span className="text-[10px] text-slate-400">Traffic & waiting duration</span>
          </div>

          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Minimum Floor Fare ($)
            </label>
            <input
              type="number"
              step="0.5"
              value={formData.minimumFare}
              onChange={(e) => handleFieldChange("minimumFare", parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white"
            />
            <span className="text-[10px] text-slate-400">Minimum guaranteed charge</span>
          </div>

          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Cancellation Fee ($)
            </label>
            <input
              type="number"
              step="0.5"
              value={formData.cancellationFee}
              onChange={(e) => handleFieldChange("cancellationFee", parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white"
            />
            <span className="text-[10px] text-slate-400">Applies after 3 min grace</span>
          </div>

          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Airport Facility Fee ($)
            </label>
            <input
              type="number"
              step="0.5"
              value={formData.airportTollFee}
              onChange={(e) => handleFieldChange("airportTollFee", parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white"
            />
            <span className="text-[10px] text-slate-400">Port authority pass-through</span>
          </div>

          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Platform Commission (%)
            </label>
            <input
              type="number"
              step="0.5"
              value={formData.platformCommissionPercent}
              onChange={(e) =>
                handleFieldChange("platformCommissionPercent", parseFloat(e.target.value))
              }
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white font-bold text-[#189578]"
            />
            <span className="text-[10px] text-slate-400">Platform take rate (15%)</span>
          </div>

          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
            <label className="font-bold text-slate-700 dark:text-slate-200">
              Maximum Surge Multiplier Cap
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.surgeCapMultiplier}
              onChange={(e) =>
                handleFieldChange("surgeCapMultiplier", parseFloat(e.target.value))
              }
              className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white font-bold text-[#F94B35]"
            />
            <span className="text-[10px] text-slate-400">Legal maximum surge cap</span>
          </div>
        </div>

        {/* Dynamic Surge Algorithm Controls */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-950/60 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Automated Dynamic Surge Pricing Algorithm
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {formData.isSurgeAutomated ? "Algorithm Enabled" : "Manual Override Mode"}
              </span>
              <input
                type="checkbox"
                checked={formData.isSurgeAutomated}
                onChange={(e) => handleFieldChange("isSurgeAutomated", e.target.checked)}
                className="h-4 w-4 accent-[#F94B35]"
              />
            </div>
          </div>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
            When enabled, Redis sliding window monitoring continuously calculates the ratio of unassigned
            requests against online captains in each PostGIS geofence polygon. Surge adjusts automatically
            between 1.0x and {formData.surgeCapMultiplier}x in 0.1x increments.
          </p>
        </div>
      </div>

      {/* Geofence Zones List */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#7A2B66]" />
          Configured Geofence Polygons ({geofences.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {geofences.map((zone) => (
            <div
              key={zone.id}
              className="rounded-2xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {zone.name}
                  </h4>
                  <span className="text-[10px] text-slate-400">{zone.city}</span>
                </div>
                <Badge
                  variant={zone.type === "HIGH_DEMAND" ? "coral" : "plum"}
                  size="sm"
                >
                  {zone.type}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#211226]">
                  <span className="text-[10px] text-slate-400">Current Surge</span>
                  <p className="font-mono font-bold text-[#F94B35] mt-0.5">
                    {zone.surgeFactor}x
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#211226]">
                  <span className="text-[10px] text-slate-400">Captains In Zone</span>
                  <p className="font-mono font-bold text-emerald-600 mt-0.5">
                    {zone.activeCaptainsCount}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Confirmation Dialog with Mandatory Reason */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Update City Pricing Matrix"
        description={`Saving this configuration will immediately update active fare calculations and passenger quote estimations in ${formData.city}.`}
        targetEntityLabel={formData.city}
        confirmText="Publish New Rate Matrix"
        isDestructive={false}
        requireReason={true}
        reasonPlaceholder="Specify economic or operational justification for pricing adjustments..."
        onConfirm={(reason) => {
          setShowConfirmDialog(false);
          onSavePricing(formData, reason);
          setHasUnsavedChanges(false);
        }}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </div>
  );
};
