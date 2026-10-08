"use client";

import React, { useState } from "react";
import {
  ScrollText,
  Search,
  Download,
  Filter,
  Eye,
  Calendar,
  Shield,
  FileCode,
  X,
} from "lucide-react";
import { AuditLogEntry, StaffRole } from "@/types";
import { Badge } from "@/components/Badge";

interface AuditLogsViewProps {
  logs: AuditLogEntry[];
  role: StaffRole;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, role }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (categoryFilter !== "ALL" && log.category !== categoryFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.actor.name.toLowerCase().includes(q) ||
        log.actor.email.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q) ||
        (log.reasonNotes && log.reasonNotes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const exportCSV = () => {
    const headers = [
      "ID",
      "Timestamp",
      "ActorName",
      "ActorRole",
      "Action",
      "Category",
      "TargetID",
      "IPAddress",
      "Justification",
    ];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.actor.name,
      l.actor.role,
      l.action,
      l.category,
      l.targetId,
      l.ipAddress,
      `"${l.reasonNotes || ""}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `amoorgo_audit_logs_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Immutable Audit Trail & Compliance Log
          </h1>
          <p className="text-xs text-slate-500">
            Cryptographically timestamped record of administrative interventions, price changes, and refunds
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-colors shadow-xs"
        >
          <Download className="h-4 w-4" />
          Export Audit Trail (CSV)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {["ALL", "RIDE", "CAPTAIN", "FINANCE", "SAFETY", "CONFIG", "STAFF"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, actor, target ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        <div className="data-table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Source IP</th>
                <th className="py-3 px-4">Audit Justification</th>
                <th className="py-3 px-4 text-center">State Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {log.actor.name}
                    </span>
                    <p className="text-[10px] text-slate-400">{log.actor.role}</p>
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                    {log.action}
                  </td>

                  <td className="py-3 px-4">
                    <Badge variant="plum" size="sm">
                      {log.category}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                    {log.targetType}: {log.targetId}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                    {log.ipAddress}
                  </td>

                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                    {log.reasonNotes || "Automated system trigger"}
                  </td>

                  <td className="py-3 px-4 text-center">
                    {log.diff ? (
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="rounded-lg bg-[#FAF0F7] dark:bg-[#331A3B] text-[#7A2B66] dark:text-[#E9BFDF] px-2.5 py-1 text-xs font-bold hover:bg-[#3A102F] hover:text-white transition-all inline-flex items-center gap-1"
                      >
                        <FileCode className="h-3.5 w-3.5" />
                        View Diff
                      </button>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* State Diff Inspector Modal */}
      {selectedLog && selectedLog.diff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  State Mutation Diff: {selectedLog.action}
                </h3>
                <p className="text-xs text-slate-500">
                  Target: {selectedLog.targetType} ({selectedLog.targetId}) • By {selectedLog.actor.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="font-bold text-rose-500 uppercase text-[10px]">
                  Before State
                </span>
                <pre className="p-3 rounded-xl bg-slate-900 text-rose-300 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(selectedLog.diff.before, null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-emerald-500 uppercase text-[10px]">
                  After State
                </span>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(selectedLog.diff.after, null, 2)}
                </pre>
              </div>
            </div>

            {selectedLog.reasonNotes && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B] text-xs">
                <strong className="text-slate-700 dark:text-slate-300">Logged Justification: </strong>
                <span className="text-slate-600 dark:text-slate-400">{selectedLog.reasonNotes}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-xl bg-[#3A102F] text-white px-5 py-2 text-xs font-bold hover:bg-[#521A44]"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
