"use client";

import React, { useState } from "react";
import {
  Car,
  Search,
  Filter,
  Download,
  Eye,
  Sliders,
  RotateCcw,
  Ban,
  Clock,
  ArrowUpDown,
  MapPin,
  Calendar,
} from "lucide-react";
import { Ride, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";

interface RidesViewProps {
  rides: Ride[];
  selectedCity: string;
  role: StaffRole;
  onSelectRide: (ride: Ride) => void;
}

export const RidesView: React.FC<RidesViewProps> = ({
  rides,
  selectedCity,
  role,
  onSelectRide,
}) => {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("ALL");

  const filteredRides = rides.filter((ride) => {
    if (selectedCity !== "All Cities" && ride.city !== selectedCity) return false;
    if (activeTab !== "ALL" && ride.status !== activeTab) return false;
    if (serviceTypeFilter !== "ALL" && ride.serviceType !== serviceTypeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        ride.bookingCode.toLowerCase().includes(q) ||
        ride.rider.name.toLowerCase().includes(q) ||
        ride.rider.phone.includes(q) ||
        (ride.captain && ride.captain.name.toLowerCase().includes(q)) ||
        (ride.captain && ride.captain.vehiclePlate.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const exportCSV = () => {
    const headers = [
      "BookingCode",
      "City",
      "ServiceType",
      "Status",
      "Rider",
      "Captain",
      "GrossFare",
      "PlatformFee",
      "DriverPayout",
      "PaymentStatus",
    ];
    const rows = filteredRides.map((r) => [
      r.bookingCode,
      r.city,
      r.serviceType,
      r.status,
      r.rider.name,
      r.captain ? r.captain.name : "None",
      r.fare.grossFare,
      r.fare.platformCommission,
      r.fare.captainNetPayout,
      r.paymentStatus,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `amoorgo_rides_${selectedCity}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Rides & Dispatch Operations
          </h1>
          <p className="text-xs text-slate-500">
            Monitor ride state machines, dispatch offers, GPS routes, and fare audits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-colors shadow-xs"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Top Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Rides</span>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {rides.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Completed Trips</span>
          <p className="text-lg font-black text-emerald-600 mt-0.5">
            {rides.filter((r) => r.status === "COMPLETED").length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Now</span>
          <p className="text-lg font-black text-[#7A2B66] dark:text-[#DB99CC] mt-0.5">
            {rides.filter((r) => r.status === "ON_TRIP" || r.status === "ARRIVING").length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Cancellations</span>
          <p className="text-lg font-black text-[#F94B35] mt-0.5">
            {rides.filter((r) => r.status === "CANCELLED").length}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {["ALL", "ON_TRIP", "ARRIVING", "SEARCHING", "COMPLETED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setActiveTab(st)}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                activeTab === st
                  ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Search & Service Select */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, phone, plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Services</option>
            <option value="AMOOR_GO">AmoorGo Standard</option>
            <option value="AMOOR_PRIME">Amoor Prime</option>
            <option value="AMOOR_EV">Amoor EV</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        <div className="data-table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Booking Code</th>
                <th className="py-3.5 px-4">City / Service</th>
                <th className="py-3.5 px-4">Passenger</th>
                <th className="py-3.5 px-4">Assigned Captain</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Gross Fare</th>
                <th className="py-3.5 px-4 text-right">Commission (15%)</th>
                <th className="py-3.5 px-4 text-right">Captain Net</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {filteredRides.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    No rides found matching query.
                  </td>
                </tr>
              ) : (
                filteredRides.map((ride) => {
                  const statusMap: Record<string, "plum" | "teal" | "coral" | "warning"> = {
                    ON_TRIP: "plum",
                    ARRIVING: "teal",
                    SEARCHING: "warning",
                    COMPLETED: "teal",
                    CANCELLED: "coral",
                  };

                  return (
                    <tr
                      key={ride.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#28162E]/30 transition-colors"
                    >
                      {/* Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {ride.bookingCode}
                          </span>
                          {ride.hasSOSAlert && (
                            <span className="text-[10px] text-rose-500 font-black animate-pulse">
                              🚨 SOS
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          PIN: {ride.otpPin}
                        </span>
                      </td>

                      {/* City / Service */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ride.city}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {ride.serviceType.replace("AMOOR_", "")}
                        </p>
                      </td>

                      {/* Rider */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <img
                            src={ride.rider.avatar}
                            alt={ride.rider.name}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {ride.rider.name}
                            </p>
                            <p className="text-[10px] text-slate-400">{ride.rider.phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Captain */}
                      <td className="py-3 px-4">
                        {ride.captain ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={ride.captain.avatar}
                              alt={ride.captain.name}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                {ride.captain.name}
                              </p>
                              <p className="text-[10px] font-mono text-[#7A2B66] dark:text-[#DB99CC]">
                                {ride.captain.vehiclePlate}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Matching...</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge variant={statusMap[ride.status] || "neutral"} size="sm" dot>
                          {ride.status.replace("_", " ")}
                        </Badge>
                      </td>

                      {/* Gross Fare */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ${ride.fare.grossFare.toFixed(2)}
                      </td>

                      {/* Platform Fee */}
                      <td className="py-3 px-4 text-right font-mono text-[#189578] font-semibold">
                        ${ride.fare.platformCommission.toFixed(2)}
                      </td>

                      {/* Captain Payout */}
                      <td className="py-3 px-4 text-right font-mono text-[#7A2B66] dark:text-[#DB99CC] font-bold">
                        ${ride.fare.captainNetPayout.toFixed(2)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectRide(ride)}
                          className="rounded-lg bg-[#FAF0F7] dark:bg-[#331A3B] px-3 py-1.5 font-bold text-[#7A2B66] dark:text-[#E9BFDF] hover:bg-[#3A102F] hover:text-white transition-all flex items-center justify-center gap-1 mx-auto"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
