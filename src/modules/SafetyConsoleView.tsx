"use client";

import React from "react";
import {
  ShieldAlert,
  Siren,
  Clock,
  PhoneCall,
  CheckCircle,
  AlertTriangle,
  Battery,
  Gauge,
  MapPin,
  FileText,
  Volume2,
} from "lucide-react";
import { SOSIncident, StaffRole, Ride } from "@/types";
import { Badge } from "@/components/Badge";

interface SafetyConsoleViewProps {
  incidents: SOSIncident[];
  rides: Ride[];
  role: StaffRole;
  onOpenSOSModal: (incident: SOSIncident) => void;
  onAcknowledge: (incidentId: string) => void;
}

export const SafetyConsoleView: React.FC<SafetyConsoleViewProps> = ({
  incidents,
  rides,
  role,
  onOpenSOSModal,
  onAcknowledge,
}) => {
  const activeIncidents = incidents.filter((i) => i.status === "ACTIVE");
  const resolvedIncidents = incidents.filter((i) => i.status !== "ACTIVE");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Safety & Emergency Incident Console
            </h1>
            <Badge variant="coral" size="sm">
              SLA Monitored
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Real-time SOS triggers, 60s acknowledgement SLA, telemetry monitoring, and law enforcement relay
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1] dark:bg-[#38110D] px-3.5 py-2 text-xs text-right">
            <span className="text-[10px] text-[#F94B35] uppercase font-bold">Active Alarms</span>
            <p className="font-mono font-black text-[#D93320]">
              {activeIncidents.length} Critical
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Resolved Today</span>
            <p className="font-mono font-black text-emerald-600">
              {resolvedIncidents.length} Handled
            </p>
          </div>
        </div>
      </div>

      {/* Active Critical Incidents */}
      {activeIncidents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#F94B35] flex items-center gap-2">
            <Siren className="h-4 w-4 animate-bounce" />
            Active Emergencies Requiring Immediate Response
          </h2>

          <div className="space-y-4">
            {activeIncidents.map((incident) => {
              const matchedRide = rides.find((r) => r.id === incident.rideId);
              return (
                <div
                  key={incident.id}
                  className="rounded-3xl border-2 border-[#F94B35] bg-white dark:bg-[#180D1C] p-6 shadow-xl space-y-4 animate-sos"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F94B35] text-white">
                        <Siren className="h-6 w-6 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-[#F94B35]">
                            SOS #{incident.id} • {incident.city}
                          </span>
                          <Badge variant="coral" size="sm" pulse>
                            {incident.status}
                          </Badge>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Triggered by {incident.triggeredBy}: {incident.userName} ({incident.userPhone})
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-[#FFF3F1] dark:bg-[#38110D] border border-[#FFC4BC] px-4 py-2 text-center text-[#D93320]">
                        <span className="text-[10px] font-bold uppercase">SLA TIMER</span>
                        <p className="text-xl font-mono font-black">
                          {incident.slaSecondsLeft}s Left
                        </p>
                      </div>

                      <button
                        onClick={() => onOpenSOSModal(incident)}
                        className="rounded-xl bg-[#F94B35] hover:bg-[#D93320] text-white px-5 py-2.5 text-xs font-bold transition-all shadow-md"
                      >
                        Launch Incident Command
                      </button>
                    </div>
                  </div>

                  {/* Telemetry info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Speed</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-white">
                        {incident.speedMph || 35} mph
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Battery</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-white">
                        {incident.batteryLevel}%
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Linked Trip</span>
                      <p className="font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                        {matchedRide ? matchedRide.bookingCode : incident.rideId}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Audio Buffer</span>
                      <p className="font-bold text-emerald-600">Available (Encrypted)</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incident History Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Incident Resolution Log
        </h2>

        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Initiator</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Staff</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Resolution Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {resolvedIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {inc.id}
                  </td>
                  <td className="py-3 px-4">{inc.city}</td>
                  <td className="py-3 px-4 font-semibold">
                    {inc.userName} ({inc.triggeredBy})
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="teal" size="sm">
                      {inc.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                    {inc.assignedStaff || "Operations Lead"}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{inc.timestamp}</td>
                  <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                    {inc.responderNotes[inc.responderNotes.length - 1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
