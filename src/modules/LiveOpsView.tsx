"use client";

import React, { useState } from "react";
import {
  Radar,
  Car,
  Users,
  Search,
  Filter,
  Layers,
  Siren,
  PhoneCall,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Ride, Captain, SOSIncident, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";
import { LiveMap } from "@/components/LiveMap";

interface LiveOpsViewProps {
  rides: Ride[];
  captains: Captain[];
  sosIncidents: SOSIncident[];
  selectedCity: string;
  role: StaffRole;
  onSelectRide: (ride: Ride) => void;
  onOpenSOSModal: () => void;
}

export const LiveOpsView: React.FC<LiveOpsViewProps> = ({
  rides,
  captains,
  sosIncidents,
  selectedCity,
  role,
  onSelectRide,
  onOpenSOSModal,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const activeRides = rides.filter(
    (r) => r.status === "ON_TRIP" || r.status === "ARRIVING" || r.status === "SEARCHING" || r.status === "ACCEPTED"
  );

  const filteredRides = activeRides.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.bookingCode.toLowerCase().includes(q) ||
        r.rider.name.toLowerCase().includes(q) ||
        (r.captain && r.captain.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeSOS = sosIncidents.find((s) => s.status === "ACTIVE");

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header with Title and Live Counts */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Live Fleet & Dispatch Radar
            </h1>
            <Badge variant="teal" size="sm" dot pulse>
              SOCKET LIVE (3s sync)
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Real-time telemetry, geofence status, and active ride interventions in {selectedCity}
          </p>
        </div>

        {activeSOS && (
          <button
            onClick={onOpenSOSModal}
            className="flex items-center gap-2 rounded-xl bg-[#F94B35] text-white px-4 py-2 text-xs font-bold shadow-md hover:bg-[#D93320] transition-all animate-sos"
          >
            <Siren className="h-4 w-4 animate-bounce" />
            <span>Emergency In Progress ({activeSOS.slaSecondsLeft}s left)</span>
          </button>
        )}
      </div>

      {/* Main Grid: Left Map (70%) + Right Active Rides Stream (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Map Column */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <LiveMap
            captains={captains}
            activeRides={activeRides}
            sosIncidents={sosIncidents}
            selectedCity={selectedCity}
            onSelectRide={onSelectRide}
          />
        </div>

        {/* Active Rides Stream Column */}
        <div className="lg:col-span-4 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 flex flex-col h-[540px] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#331A3B]">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Active Trips ({filteredRides.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              City: {selectedCity}
            </span>
          </div>

          {/* Search & Filter */}
          <div className="py-2.5 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ride #, rider, captain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
              {["ALL", "ON_TRIP", "ARRIVING", "SEARCHING"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? "bg-[#3A102F] text-white"
                      : "bg-slate-100 dark:bg-[#211226] text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* List of Active Rides */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredRides.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                No active rides matching filter.
              </div>
            ) : (
              filteredRides.map((ride) => (
                <div
                  key={ride.id}
                  onClick={() => onSelectRide(ride)}
                  className={`rounded-xl border p-3 cursor-pointer transition-all hover:scale-[1.01] ${
                    ride.hasSOSAlert
                      ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
                      : "border-slate-200 dark:border-[#331A3B] hover:border-[#7A2B66] bg-slate-50/50 dark:bg-[#211226]/40"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {ride.bookingCode}
                    </span>
                    <Badge
                      variant={
                        ride.status === "ON_TRIP"
                          ? "plum"
                          : ride.status === "ARRIVING"
                          ? "teal"
                          : "warning"
                      }
                      size="sm"
                    >
                      {ride.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Rider:</span>
                      <span className="font-semibold">{ride.rider.name}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Captain:</span>
                      <span className="font-semibold">
                        {ride.captain ? ride.captain.name : "Matching..."}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Fare:</span>
                      <span className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                        ${ride.fare.grossFare.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span className="truncate max-w-[180px]">
                      {ride.pickupAddress.split(",")[0]} → {ride.dropoffAddress.split(",")[0]}
                    </span>
                    <span className="text-[#7A2B66] dark:text-[#DB99CC] font-bold">
                      Inspect →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
