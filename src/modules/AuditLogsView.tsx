"use client";

import React, { useMemo, useState } from "react";
import { Search, Download, FileCode, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, saveBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useCursorList } from "@/lib/hooks/useQuery";
import { useMutation } from "@/lib/hooks/useMutation";
import { useOnInvalidate } from "@/lib/invalidate";
import { ApiAuditEntry, AuditEntryView, AUDIT_CATEGORIES, toAuditEntry } from "@/lib/adapters/audit";
import { formatDateTime } from "@/lib/format";

/** Date input (YYYY-MM-DD, local) -> ISO bound. `to` is inclusive of the whole day. */
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

export const AuditLogsView: React.FC = () => {
  const { can } = useAuth();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditEntryView | null>(null);

  const q = useDebouncedValue(searchTerm.trim(), 350);
  const query = useMemo(
    () => ({
      q: q || undefined,
      category: categoryFilter === "ALL" ? undefined : categoryFilter,
      from: dayStart(fromDate),
      to: dayEnd(toDate),
    }),
    [q, categoryFilter, fromDate, toDate],
  );

  const list = useCursorList<ApiAuditEntry>("/admin/audit-logs", query, { limit: 50 });
  useOnInvalidate("audit", list.refetch);
  const logs = useMemo(() => list.items.map(toAuditEntry), [list.items]);

  // The CSV endpoint needs both audit.view and reports.export, and the bearer header, so it is fetched and saved client-side.
  const exportCsv = useMutation(async () => {
    const file = await api.download("/admin/audit-logs/export", { query }, "audit-logs.csv");
    saveBlob(file);
  });

  const runExport = async () => {
    const res = await exportCsv.run();
    if (res.ok) toast.success("Audit trail exported");
    else toast.error(res.error);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Immutable Audit Trail & Compliance Log</h1>
          <p className="text-xs text-slate-500">Timestamped record of administrative interventions, price changes, and refunds</p>
        </div>

        {can("reports.export") && (
          <button
            onClick={runExport}
            disabled={exportCsv.pending}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-colors shadow-xs disabled:opacity-60"
            title="Exports up to 10,000 rows matching the current filters"
          >
            {exportCsv.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Audit Trail (CSV)
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
            {["ALL", ...AUDIT_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                  categoryFilter === cat ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
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
              placeholder="Search action, actor, target ID, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-1.5">
            From
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-2 py-1 text-slate-800 dark:text-white" />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-2 py-1 text-slate-800 dark:text-white" />
          </label>
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="font-semibold text-[#7A2B66] hover:underline dark:text-[#DB99CC]"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {list.error && <ErrorBanner error={list.error} title="Could not load the audit trail" onRetry={list.refetch} />}

      {/* Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        {list.initialLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : logs.length === 0 && !list.error ? (
          <EmptyState title="No audit entries match" description="Try a different category, date range or search term." />
        ) : (
          <div className="data-table-container overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
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
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">{log.actorName}</span>
                      <p className="text-[10px] text-slate-400">{log.actorRole}</p>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">{log.action}</td>

                    <td className="py-3 px-4">
                      <Badge variant="plum" size="sm">
                        {log.category}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 max-w-[14rem] truncate" title={`${log.targetType}: ${log.targetId}`}>
                      {log.targetType}: {log.targetId}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{log.ipAddress}</td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.reasonNotes ?? undefined}>
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
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </div>

      {/* State Diff Inspector Modal */}
      {selectedLog && selectedLog.diff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">State Mutation Diff: {selectedLog.action}</h3>
                <p className="text-xs text-slate-500">
                  Target: {selectedLog.targetType} ({selectedLog.targetId}) • By {selectedLog.actorName}
                </p>
                {selectedLog.requestId && <p className="font-mono text-[10px] text-slate-400">Request ID: {selectedLog.requestId}</p>}
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="font-bold text-rose-500 uppercase text-[10px]">Before State</span>
                <pre className="p-3 rounded-xl bg-slate-900 text-rose-300 overflow-x-auto text-[11px] leading-relaxed">{JSON.stringify(selectedLog.diff.before, null, 2)}</pre>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-emerald-500 uppercase text-[10px]">After State</span>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 overflow-x-auto text-[11px] leading-relaxed">{JSON.stringify(selectedLog.diff.after, null, 2)}</pre>
              </div>
            </div>

            {selectedLog.reasonNotes && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B] text-xs">
                <strong className="text-slate-700 dark:text-slate-300">Logged Justification: </strong>
                <span className="text-slate-600 dark:text-slate-400">{selectedLog.reasonNotes}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedLog(null)} className="rounded-xl bg-[#3A102F] text-white px-5 py-2 text-xs font-bold hover:bg-[#521A44]">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

