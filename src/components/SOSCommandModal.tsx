"use client";

import React, { useState } from "react";
import { PhoneCall, Siren, Battery, Gauge, MapPin, UserCheck, ClipboardList, ArrowUpCircle, Car, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "./Badge";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import {
  CONTACT_METHODS,
  CONTACT_OUTCOMES,
  CONTACT_PARTIES,
  RESOLVE_OUTCOMES,
  eventTitle,
  isOpen,
  toIncident,
  type ApiIncidentDetail,
  type ApiIncidentEvent,
  type ApiIncidentSummary,
  type ContactMethod,
  type ContactOutcome,
  type ContactParty,
  type IncidentUpdatedEvent,
} from "@/lib/adapters/safety";
import { useCities } from "@/lib/cities/CityProvider";
import { formatDateTime, formatTime, humanize } from "@/lib/format";
import { useMutation } from "@/lib/hooks/useMutation";
import { useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import { useSocketEvent } from "@/lib/realtime";
import { useNow } from "@/lib/safety/useNow";
import { useStaffDirectory } from "@/lib/safety/useStaffDirectory";

interface SOSCommandModalProps {
  incidentId: string | null;
  onClose: () => void;
}

export const SOSCommandModal: React.FC<SOSCommandModalProps> = ({ incidentId, onClose }) => {
  if (!incidentId) return null;
  return <IncidentCommand key={incidentId} incidentId={incidentId} onClose={onClose} />;
};

type CloseKind = "resolve" | "false_alarm" | "escalate";

const selectCls = "w-full rounded-xl border border-slate-300 dark:border-[#331A3B] px-3 py-2 text-xs dark:bg-[#211226] dark:text-white";

const IncidentCommand: React.FC<{ incidentId: string; onClose: () => void }> = ({ incidentId, onClose }) => {
  const toast = useToast();
  const { cityName } = useCities();
  const staff = useStaffDirectory();

  const detail = useQuery<ApiIncidentDetail>(`incident:${incidentId}`, (signal) => api.get<ApiIncidentDetail>(`/admin/incidents/${incidentId}`, { signal }), { pollMs: 15_000 });
  useOnInvalidate("incidents", detail.refetch);
  const { refetch } = detail;
  useSocketEvent<IncidentUpdatedEvent>("incident.updated", (p) => {
    if (p && p.id === incidentId) refetch();
  });

  const data = detail.data;
  const open = data ? isOpen(data) : false;
  const now = useNow(1000, data?.status === "ACTIVE" && data.type === "SOS");
  const incident = data ? toIncident(data, { now, cityName, staffName: staff.nameOf }, data) : null;

  const [newNote, setNewNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [closing, setClosing] = useState<CloseKind | null>(null);
  const [outcomeCode, setOutcomeCode] = useState<string>("SAFE_CONFIRMED");
  const [party, setParty] = useState<ContactParty>("USER");
  const [outcome, setOutcome] = useState<ContactOutcome>("REACHED");
  const [method, setMethod] = useState<ContactMethod>("CALL");
  const [contactNote, setContactNote] = useState("");

  const done = (msg: string) => {
    toast.success(msg);
    invalidate("incidents");
  };

  const ack = useMutation(() => api.post<ApiIncidentSummary>(`/admin/incidents/${incidentId}/acknowledge`));
  const assign = useMutation((staffId: string) => api.post<ApiIncidentSummary>(`/admin/incidents/${incidentId}/assign`, { staffId }));
  const note = useMutation((text: string) => api.post<ApiIncidentSummary>(`/admin/incidents/${incidentId}/note`, { note: text }));
  const contact = useMutation((body: { party: ContactParty; outcome: ContactOutcome; method: ContactMethod; note?: string }) =>
    api.post<ApiIncidentSummary>(`/admin/incidents/${incidentId}/contact`, body),
  );

  const onAck = async () => {
    const r = await ack.run();
    if (r.ok) done("Incident acknowledged.");
  };
  const onAssign = async () => {
    const target = assignee || staff.meId;
    if (!target) return;
    const r = await assign.run(target);
    if (r.ok) done(`Assigned to ${staff.nameOf(target) ?? "staff member"}.`);
  };
  const onNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    const r = await note.run(text);
    if (r.ok) {
      setNewNote("");
      done("Note added.");
    }
  };
  const onContact = async () => {
    const r = await contact.run({ party, outcome, method, ...(contactNote.trim() ? { note: contactNote.trim() } : {}) });
    if (r.ok) {
      setContactNote("");
      done("Contact attempt logged.");
    }
  };

  const confirmClose = async (reason: string): Promise<void> => {
    if (!closing) return;
    if (closing === "escalate") {
      await api.post(`/admin/incidents/${incidentId}/escalate`, { reason });
      done("Incident escalated.");
      setClosing(null);
      return;
    }
    const code = closing === "false_alarm" ? "FALSE_ALARM" : outcomeCode;
    await api.post(`/admin/incidents/${incidentId}/resolve`, { outcomeCode: code, note: reason });
    done(closing === "false_alarm" ? "Closed as false alarm." : "Incident resolved.");
    setClosing(null);
    onClose();
  };

  const snap = data?.snapshot ?? null;
  const trail = snap?.recentLocations ?? [];
  const busy = ack.pending || assign.pending || note.pending || contact.pending;
  const isBreached = !!incident && incident.slaRunning && (incident.slaSecondsLeft === 0 || incident.slaBreached);
  const triggerer = data?.contacts.triggeredBy ?? null;
  const counterparty = data?.contacts.counterparty ?? null;
  const actionError = ack.error ?? assign.error ?? note.error ?? contact.error;
  const effectiveAssignee = assignee || data?.assignedStaffId || staff.meId || "";

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        variant="center"
        widthClass="sm:max-w-4xl"
        fill
        danger
        strongBackdrop
        headerClassName="bg-[#FFF3F1] dark:bg-[#38110D]"
        bodyClassName="space-y-6 p-4 sm:p-6"
        header={
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F94B35] text-white shadow-lg ${open ? "animate-pulse" : ""}`}>
              <Siren className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#D93320] dark:text-[#FF7361]">{data ? `${humanize(data.severity)} severity ${humanize(data.type)}` : "Incident"}</span>
                {data && (
                  <Badge variant={open ? "coral" : "teal"} size="sm" pulse={data.status === "ACTIVE"}>
                    {data.status.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{incident ? `${incident.ref} • ${incident.city}` : "Loading incident..."}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {incident && incident.slaRunning ? (
              <div
                className={`rounded-2xl px-4 py-2 text-center border ${
                  isBreached ? "bg-rose-600 text-white border-rose-700 animate-bounce" : "bg-white dark:bg-[#180D1C] border-[#FFC4BC] text-[#D93320]"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider">{isBreached ? "SLA BREACHED" : "SLA ACKNOWLEDGE"}</div>
                <div className="text-2xl font-mono font-black">{incident.slaSecondsLeft}s</div>
              </div>
            ) : data ? (
              <Badge variant="teal" size="lg">
                {data.status === "ACKNOWLEDGED"
                  ? `Acknowledged${data.assignedStaffId ? ` by ${staff.nameOf(data.assignedStaffId) ?? "dispatch"}` : ""}`
                  : data.status === "ACTIVE"
                    ? "Open (no SLA)"
                    : `Closed${data.outcomeCode ? `: ${humanize(data.outcomeCode)}` : ""}`}
              </Badge>
            ) : null}
          </div>
          </div>
        }
        footer={
          data ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {open ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  {data.status === "ACTIVE" && (
                    <button
                      onClick={onAck}
                      disabled={busy}
                      className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#14755F] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#0E3D32] disabled:opacity-50 sm:col-span-1"
                    >
                      {ack.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                      Acknowledge Incident{data.type === "SOS" ? " (Stop SLA Timer)" : ""}
                    </button>
                  )}
                  <select value={effectiveAssignee} onChange={(e) => setAssignee(e.target.value)} className="min-w-0 rounded-xl border border-slate-300 px-2.5 py-2.5 text-xs dark:border-[#331A3B] dark:bg-[#211226] dark:text-white" aria-label="Assign to">
                    {staff.options.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id === staff.meId ? `${s.name} (me)` : s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={onAssign}
                    disabled={busy || !effectiveAssignee || effectiveAssignee === data.assignedStaffId}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#28162E]"
                  >
                    {assign.pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {data.assignedStaffId ? "Reassign" : "Assign"}
                  </button>
                  <button
                    onClick={() => setClosing("escalate")}
                    disabled={busy}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#FFC4BC] px-3 py-2.5 text-xs font-bold text-[#B02414] hover:bg-[#FFF3F1] disabled:opacity-50 dark:border-[#61130A] dark:text-[#FFA093] dark:hover:bg-[#38110D] sm:col-span-1"
                  >
                    <ArrowUpCircle className="h-4 w-4" /> Escalate
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
                  <button
                    onClick={() => setClosing("false_alarm")}
                    disabled={busy}
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#28162E] sm:px-4"
                  >
                    Mark False Alarm
                  </button>
                  <button onClick={() => setClosing("resolve")} disabled={busy} className="rounded-xl bg-[#3A102F] px-3 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#521A44] disabled:opacity-50 dark:bg-[#7A2B66] dark:hover:bg-[#A74490] sm:px-5">
                    <span className="sm:hidden">Resolve</span>
                    <span className="hidden sm:inline">Close & Resolve Incident</span>
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This incident is closed{data.resolvedAt ? ` (${formatDateTime(data.resolvedAt)})` : ""}. Notes can still be added for post-incident review.
              </p>
            )}
            </div>
          ) : undefined
        }
      >
          {detail.error && <ErrorBanner error={detail.error} title="Could not load this incident" onRetry={detail.refetch} />}
          {detail.initialLoading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {data && incident && (
            <>
              {data.description && (
                <p className="rounded-2xl border border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1]/50 dark:bg-[#38110D]/30 p-4 text-sm text-slate-800 dark:text-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B02414] dark:text-[#FFA093]">Reported message</span>
                  <br />
                  {data.description}
                </p>
              )}

              {/* Telemetry and Trigger Info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Card label="Triggered By">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {incident.triggeredBy === "CAPTAIN" ? "Captain" : "Rider"}: {incident.userName}
                  </p>
                  {incident.userPhone ? (
                    <a href={`tel:${incident.userPhone}`} className="text-xs text-[#7A2B66] dark:text-[#DB99CC] hover:underline">
                      {incident.userPhone}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Phone unavailable</p>
                  )}
                </Card>

                <Card label="Vehicle Speed">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="h-4 w-4 text-[#7A2B66]" />
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{incident.speedMph !== undefined ? `${incident.speedMph} mph` : "Unknown"}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{incident.speedMph !== undefined ? "Captain's last reported speed" : "No speed reading captured"}</p>
                </Card>

                <Card label="Device Battery">
                  <div className="flex items-center gap-1.5">
                    <Battery className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{incident.battery !== null ? `${incident.battery}%` : "Unknown"}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{incident.battery !== null && incident.battery <= 15 ? "Battery critically low" : "Reported by the app at trigger time"}</p>
                </Card>

                <Card label={data.liveLocation ? "Captain Live GPS" : "Trigger Location"}>
                  {data.liveLocation || incident.hasCoords ? (
                    <>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-[#D93320] dark:text-[#FF7361]" />
                        <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                          {(data.liveLocation?.lat ?? incident.coords[0]).toFixed(5)}, {(data.liveLocation?.lng ?? incident.coords[1]).toFixed(5)}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${data.liveLocation?.lat ?? incident.coords[0]},${data.liveLocation?.lng ?? incident.coords[1]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#7A2B66] dark:text-[#DB99CC] hover:underline"
                      >
                        Open in maps <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No location captured</p>
                  )}
                </Card>
              </div>

              {/* Ride & participants */}
              {snap?.ride && (
                <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Car className="h-3.5 w-3.5" /> Linked Trip {snap.ride.bookingRef} ({humanize(snap.ride.status)})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Pickup</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{snap.ride.pickup?.address ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Drop-off</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{snap.ride.drop?.address ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Rider</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {snap.rider?.name ?? "—"} {snap.rider && <span className="text-slate-500 dark:text-slate-400">★ {snap.rider.ratingAvg.toFixed(2)}</span>}
                      </p>
                      <PhoneLink phone={data.contacts.triggeredBy?.realm === "RIDER" ? data.contacts.triggeredBy.phone : data.contacts.counterparty?.realm === "RIDER" ? data.contacts.counterparty.phone : snap.rider?.phone} />
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Captain</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {snap.captain?.name ?? "Not assigned"} {snap.captain && <span className="text-slate-500 dark:text-slate-400">★ {snap.captain.ratingAvg.toFixed(2)} • {snap.captain.totalRides} rides</span>}
                      </p>
                      <PhoneLink phone={data.contacts.triggeredBy?.realm === "CAPTAIN" ? data.contacts.triggeredBy.phone : data.contacts.counterparty?.realm === "CAPTAIN" ? data.contacts.counterparty.phone : snap.captain?.phone} />
                      {snap.vehicle && (
                        <p className="text-slate-500 dark:text-slate-400">
                          {[snap.vehicle.color, snap.vehicle.make, snap.vehicle.model].filter(Boolean).join(" ")} {snap.vehicle.plateNumber ? `• ${snap.vehicle.plateNumber}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Location trail */}
              {(trail.length > 1 || snap?.captainLastLocation) && (
                <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Location Trail (last 5 minutes before trigger, {trail.length} points)</h4>
                  <TrailPlot trail={trail} sos={incident.hasCoords ? { lat: incident.coords[0], lng: incident.coords[1] } : null} last={snap?.captainLastLocation ?? null} />
                </div>
              )}

              {/* Contact log / dispatch */}
              {open && (
                <div className="rounded-2xl border border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1]/40 dark:bg-[#38110D]/30 p-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#B02414] dark:text-[#FFA093]">Contact & Dispatch Log</h4>
                  <div className="flex flex-wrap gap-2">
                    {triggerer && (
                      <QuickDial label={`Dial ${triggerer.realm === "RIDER" ? "Rider" : "Captain"}`} phone={triggerer.phone} onPick={() => setParty("USER")} />
                    )}
                    {counterparty && <QuickDial label={`Dial ${counterparty.realm === "RIDER" ? "Rider" : "Captain"}`} phone={counterparty.phone} onPick={() => setParty("COUNTERPARTY")} />}
                    {data.contacts.emergencyContacts.map((c, i) => (
                      <QuickDial key={`${c.phone}-${i}`} label={`Emergency contact: ${c.name}`} phone={c.phone} onPick={() => setParty("EMERGENCY_CONTACT")} />
                    ))}
                    <button
                      type="button"
                      onClick={() => setParty("EMERGENCY_SERVICES")}
                      className="rounded-xl bg-[#D93320] hover:bg-[#B02414] text-white px-3 py-2 text-xs font-bold flex items-center gap-2 shadow-md"
                    >
                      <Siren className="h-4 w-4" /> Log call to Police / 911
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <select value={party} onChange={(e) => setParty(e.target.value as ContactParty)} className={selectCls} aria-label="Who was contacted">
                      {CONTACT_PARTIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <select value={outcome} onChange={(e) => setOutcome(e.target.value as ContactOutcome)} className={selectCls} aria-label="Outcome">
                      {CONTACT_OUTCOMES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select value={method} onChange={(e) => setMethod(e.target.value as ContactMethod)} className={selectCls} aria-label="Method">
                      {CONTACT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={onContact}
                      disabled={contact.pending}
                      className="rounded-xl bg-[#3A102F] hover:bg-[#521A44] px-3 py-2 text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {contact.pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Log Contact
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={1000}
                    placeholder="Optional note about the call (what was said, instructions given)..."
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] px-3 py-2 text-xs dark:bg-[#211226] dark:text-white"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">The first logged contact stops the first-contact SLA clock. Calls are placed with your own phone; this records them.</p>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5" /> Incident Timeline & Notes ({data.events.length})
                </h4>
                <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-4 bg-slate-50/50 dark:bg-[#211226]/30 space-y-2.5 max-h-56 overflow-y-auto">
                  {data.events.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No events yet.</p>}
                  {[...data.events].reverse().map((e) => (
                    <EventRow key={e.id} event={e} actor={actorLabel(e, staff.nameOf)} />
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={2000}
                    placeholder="Log internal action note (e.g. Spoke with passenger, confirmed accidental trigger)..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onNote()}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-[#331A3B] px-3 py-2 text-xs dark:bg-[#211226] dark:text-white"
                  />
                  <button
                    onClick={onNote}
                    disabled={note.pending || !newNote.trim()}
                    className="rounded-xl bg-[#3A102F] text-white px-4 py-2 text-xs font-bold hover:bg-[#521A44] disabled:opacity-50 flex items-center gap-2"
                  >
                    {note.pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add Note
                  </button>
                </div>
              </div>

              {actionError && <ErrorBanner error={actionError} title="Action failed" />}
            </>
          )}
      </Sheet>

      {closing && (
        <ConfirmDialog
          isOpen
          title={closing === "escalate" ? "Escalate Incident" : closing === "false_alarm" ? "Mark as False Alarm" : "Close & Resolve Incident"}
          description={
            closing === "escalate"
              ? "Raises the severity one level and alerts every safety agent. Explain why this needs more attention."
              : closing === "false_alarm"
                ? "Closes the incident as a false alarm. Describe how it was confirmed (e.g. accidental press, spoke to the passenger)."
                : "Closes the incident. Choose the outcome and summarise what was done; this is kept in the audit trail."
          }
          targetEntityLabel={incident?.ref}
          confirmText={closing === "escalate" ? "Escalate" : closing === "false_alarm" ? "Confirm False Alarm" : "Resolve Incident"}
          isDestructive={closing === "escalate"}
          requireReason
          minReasonLength={3}
          reasonPlaceholder={closing === "escalate" ? "Reason for escalation..." : "Resolution notes (what happened, who was contacted, outcome)..."}
          onConfirm={confirmClose}
          onCancel={() => setClosing(null)}
        >
          {closing === "resolve" && (
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">Outcome</label>
              <select value={outcomeCode} onChange={(e) => setOutcomeCode(e.target.value)} className={selectCls}>
                {RESOLVE_OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  );
};

// ── pieces ──────────────────────────────────────────────────

const Card: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-[#331A3B] p-3 bg-slate-50 dark:bg-[#211226]/40 space-y-1">
    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{label}</span>
    <div>{children}</div>
  </div>
);

const PhoneLink: React.FC<{ phone?: string | null }> = ({ phone }) =>
  phone ? (
    <a href={`tel:${phone}`} className="text-[#7A2B66] dark:text-[#DB99CC] hover:underline">
      {phone}
    </a>
  ) : null;

const QuickDial: React.FC<{ label: string; phone: string; onPick: () => void }> = ({ label, phone, onPick }) => (
  <a
    href={`tel:${phone}`}
    onClick={onPick}
    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] px-3 py-2 text-xs font-bold text-slate-800 dark:text-white hover:border-[#F94B35] transition-all flex items-center gap-2 shadow-sm"
    title={phone}
  >
    <PhoneCall className="h-4 w-4 text-[#D93320] dark:text-[#FF7361]" />
    {label}
  </a>
);

function actorLabel(e: ApiIncidentEvent, nameOf: (id: string | null | undefined) => string | null): string {
  switch (e.actorRealm) {
    case "STAFF":
      return nameOf(e.actorId) ?? "Staff";
    case "RIDER":
      return "Rider";
    case "CAPTAIN":
      return "Captain";
    default:
      return "System";
  }
}

const EventRow: React.FC<{ event: ApiIncidentEvent; actor: string }> = ({ event, actor }) => (
  <div className="text-xs text-slate-700 dark:text-slate-300">
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{formatTime(event.createdAt)}</span>
      <span className="font-bold text-slate-900 dark:text-white">{eventTitle(event)}</span>
      <span className="text-slate-500 dark:text-slate-400">by {actor}</span>
    </div>
    {event.body && <p className="pl-1 text-slate-600 dark:text-slate-400 break-words">{event.body}</p>}
  </div>
);

interface PlotPoint {
  lat: number;
  lng: number;
}

/** Dependency-free trail plot: the recorded path, the captain's last fix and the SOS position, scaled to fit. */
const TrailPlot: React.FC<{ trail: PlotPoint[]; sos: PlotPoint | null; last: PlotPoint | null }> = ({ trail, sos, last }) => {
  const pts = [...trail, ...(sos ? [sos] : []), ...(last ? [last] : [])];
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const W = 520;
  const H = 150;
  const pad = 14;
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const x = (lng: number) => pad + ((lng - minLng) * k - 0) * scale + (W - pad * 2 - spanX * scale) / 2;
  const y = (lat: number) => H - pad - (lat - minLat) * scale - (H - pad * 2 - spanY * scale) / 2;
  const path = trail.map((p) => `${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36 rounded-xl bg-slate-50 dark:bg-[#211226]/40 border border-slate-200 dark:border-[#331A3B]" role="img" aria-label="Location trail">
      {trail.length > 1 && <polyline points={path} fill="none" stroke="#7A2B66" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {trail.length > 0 && <circle cx={x(trail[0].lng)} cy={y(trail[0].lat)} r="3.5" fill="#14755F" />}
      {last && <circle cx={x(last.lng)} cy={y(last.lat)} r="4" fill="#7A2B66" />}
      {sos && <circle cx={x(sos.lng)} cy={y(sos.lat)} r="6" fill="#F94B35" stroke="#fff" strokeWidth="1.5" />}
    </svg>
  );
};
