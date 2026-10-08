"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  PhoneCall,
  Siren,
  Battery,
  Gauge,
  MapPin,
  Clock,
  CheckCircle,
  FileText,
  Volume2,
  Radio,
  UserCheck,
} from "lucide-react";
import { SOSIncident, StaffRole, Ride } from "@/types";
import { Badge } from "./Badge";

interface SOSCommandModalProps {
  incident: SOSIncident | null;
  ride?: Ride;
  role: StaffRole;
  onClose: () => void;
  onAcknowledge: (incidentId: string) => void;
  onResolve: (incidentId: string, resolutionType: "RESOLVED" | "FALSE_ALARM", notes: string) => void;
}

export const SOSCommandModal: React.FC<SOSCommandModalProps> = ({
  incident,
  ride,
  onClose,
  onAcknowledge,
  onResolve,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(incident?.slaSecondsLeft || 45);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newNote, setNewNote] = useState("");
  const [notesList, setNotesList] = useState<string[]>(incident?.responderNotes || []);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [callingEntity, setCallingEntity] = useState<string | null>(null);

  useEffect(() => {
    if (!incident || incident.status !== "ACTIVE") return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [incident]);

  if (!incident) return null;

  const isBreached = secondsLeft === 0 && incident.status === "ACTIVE";

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const timeStr = new Date().toLocaleTimeString();
    setNotesList([...notesList, `${timeStr} - Staff Note: ${newNote.trim()}`]);
    setNewNote("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-[#180D1C] border-2 border-[#F94B35] shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Urgent Header Banner */}
        <div className="bg-[#FFF3F1] dark:bg-[#38110D] border-b border-[#FFC4BC] dark:border-[#61130A] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F94B35] text-white shadow-lg animate-pulse">
              <Siren className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#F94B35]">
                  PRIORITY 1 CRITICAL INCIDENT
                </span>
                <Badge variant="coral" size="sm" pulse>
                  {incident.status}
                </Badge>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                SOS Signal #{incident.id} • {incident.city}
              </h2>
            </div>
          </div>

          {/* SLA Countdown Timer */}
          <div className="flex items-center gap-4">
            {incident.status === "ACTIVE" ? (
              <div
                className={`rounded-2xl px-4 py-2 text-center border ${
                  isBreached
                    ? "bg-rose-600 text-white border-rose-700 animate-bounce"
                    : "bg-white dark:bg-[#180D1C] border-[#FFC4BC] text-[#D93320]"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider">
                  {isBreached ? "SLA BREACHED" : "SLA ACKNOWLEDGE"}
                </div>
                <div className="text-2xl font-mono font-black">
                  {secondsLeft}s
                </div>
              </div>
            ) : (
              <Badge variant="teal" size="lg">
                Acknowledged by Dispatch
              </Badge>
            )}

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-[#28162E]"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Telemetry and Trigger Info */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-3 bg-slate-50 dark:bg-[#211226]/40">
              <span className="text-[10px] font-bold uppercase text-slate-400">Triggered By</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {incident.triggeredBy} ({incident.userName})
              </p>
              <p className="text-xs text-slate-500">{incident.userPhone}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-3 bg-slate-50 dark:bg-[#211226]/40">
              <span className="text-[10px] font-bold uppercase text-slate-400">Vehicle Speed</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Gauge className="h-4 w-4 text-[#7A2B66]" />
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {incident.speedMph || 35} mph
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Active movement detected</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-3 bg-slate-50 dark:bg-[#211226]/40">
              <span className="text-[10px] font-bold uppercase text-slate-400">Device Battery</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Battery className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {incident.batteryLevel}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Strong battery level</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-3 bg-slate-50 dark:bg-[#211226]/40">
              <span className="text-[10px] font-bold uppercase text-slate-400">Live GPS</span>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4 text-[#F94B35]" />
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {incident.coords[0].toFixed(4)}, {incident.coords[1].toFixed(4)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Synced via mobile socket</p>
            </div>
          </div>

          {/* Quick Operational Dispatch Tools */}
          <div className="rounded-2xl border border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1]/40 dark:bg-[#38110D]/30 p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#B02414] dark:text-[#FFA093]">
              Emergency Rapid Dispatch Actions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Call Passenger */}
              <button
                onClick={() => {
                  setCallingEntity(`Passenger (${incident.userName})`);
                  setTimeout(() => setCallingEntity(null), 4000);
                }}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-3 text-xs font-bold text-slate-800 dark:text-white hover:border-[#F94B35] transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <PhoneCall className="h-4 w-4 text-[#F94B35]" />
                {callingEntity?.includes("Passenger") ? "Connecting Line..." : "Dial Passenger Direct"}
              </button>

              {/* Call Captain */}
              <button
                onClick={() => {
                  setCallingEntity("Captain");
                  setTimeout(() => setCallingEntity(null), 4000);
                }}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-3 text-xs font-bold text-slate-800 dark:text-white hover:border-[#F94B35] transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <PhoneCall className="h-4 w-4 text-[#7A2B66]" />
                {callingEntity?.includes("Captain") ? "Connecting Line..." : "Dial Captain Direct"}
              </button>

              {/* Relay to Police/911 */}
              <button
                onClick={() => {
                  alert(
                    `🚨 LAW ENFORCEMENT DISPATCH RELAY:\nRelaying telemetric coordinates (${incident.coords.join(
                      ", "
                    )}) and vehicle details for ${incident.city} PD.`
                  );
                }}
                className="rounded-xl bg-[#D93320] hover:bg-[#B02414] text-white p-3 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Siren className="h-4 w-4" />
                Relay to 911 / Police PSAP
              </button>
            </div>

            {/* Audio Recording Feed */}
            {incident.audioRecordingAvailable && (
              <div className="flex items-center justify-between rounded-xl bg-white dark:bg-[#180D1C] p-3 border border-slate-200 dark:border-[#331A3B]">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-[#7A2B66]" />
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    In-Cabin Audio Recording (Encrypted TNC Buffer)
                  </span>
                </div>
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="rounded-lg bg-[#FAF0F7] dark:bg-[#331A3B] px-3 py-1 text-xs font-bold text-[#7A2B66] dark:text-[#E9BFDF] hover:opacity-80"
                >
                  {isPlayingAudio ? "■ Pause Playback" : "▶ Listen Live Buffer"}
                </button>
              </div>
            )}
          </div>

          {/* Operational Log & Notes Feed */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Emergency Action Log & Notes ({notesList.length})
            </h4>
            <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-4 bg-slate-50/50 dark:bg-[#211226]/30 space-y-2 max-h-40 overflow-y-auto">
              {notesList.map((n, i) => (
                <div key={i} className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                  • {n}
                </div>
              ))}
            </div>

            {/* Add Note Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Log internal action note (e.g. Spoke with passenger, confirmed accidental trigger)..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                className="flex-1 rounded-xl border border-slate-300 dark:border-[#331A3B] px-3 py-2 text-xs dark:bg-[#211226] dark:text-white"
              />
              <button
                onClick={handleAddNote}
                className="rounded-xl bg-[#3A102F] text-white px-4 py-2 text-xs font-bold hover:bg-[#521A44]"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4 bg-white dark:bg-[#180D1C] flex flex-wrap items-center justify-between gap-4">
          <div>
            {incident.status === "ACTIVE" && (
              <button
                onClick={() => onAcknowledge(incident.id)}
                className="rounded-xl bg-[#189578] hover:bg-[#14755F] px-5 py-2.5 text-xs font-bold text-white shadow-md flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                Acknowledge Incident (Stop SLA Timer)
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onResolve(incident.id, "FALSE_ALARM", "Confirmed accidental phone tap by passenger.");
                onClose();
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#28162E]"
            >
              Mark False Alarm
            </button>
            <button
              onClick={() => {
                onResolve(incident.id, "RESOLVED", "Incident addressed by operations staff.");
                onClose();
              }}
              className="rounded-xl bg-[#3A102F] hover:bg-[#521A44] px-5 py-2.5 text-xs font-bold text-white shadow-md"
            >
              Close & Resolve Incident
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
