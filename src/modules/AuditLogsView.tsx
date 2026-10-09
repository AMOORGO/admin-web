"use client";

import React, { useMemo, useState } from "react";
import { Download, FileCode, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { ChipTabs, FilterRow, PageHeader, SearchInput, Toolbar, fieldClass } from "@/components/ui/Page";
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
      <PageHeader
        title="Immutable Audit Trail & Compliance Log"
        description="Timestamped record of administrative interventions, price changes, and refunds"
        actions={
          can("reports.export") ? (
            <button
              type="button"
              onClick={runExport}
              disabled={exportCsv.pending}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-[#331A3B] dark:bg-[#180D1C] dark:text-slate-200 dark:hover:bg-[#28162E]"
              title="Exports up to 10,000 rows matching the current filters"
            >
              {exportCsv.pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              Export Audit Trail (CSV)
            </button>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <Toolbar>
        <ChipTabs label="Audit category" items={["ALL", ...AUDIT_CATEGORIES].map((cat) => ({ id: cat, label: cat }))} value={categoryFilter} onChange={setCategoryFilter} />
        <FilterRow>
          <SearchInput value={searchTerm} onValueChange={setSearchTerm} placeholder="Search action, actor, target ID, reason..." className="min-[480px]:col-span-2 lg:w-80" />
          <label className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="w-9 shrink-0 lg:w-auto">From</span>
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="w-9 shrink-0 lg:w-auto">To</span>
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className={fieldClass} />
          </label>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="min-h-10 text-left text-xs font-semibold text-[#7A2B66] hover:underline dark:text-[#DB99CC]"
            >
              Clear dates
            </button>
          )}
        </FilterRow>
      </Toolbar>

      {list.error && <ErrorBanner error={list.error} title="Could not load the audit trail" onRetry={list.refetch} />}

      {/* Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        {list.initialLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : logs.length === 0 && !list.error ? (
          <EmptyState title="No audit entries match" description="Try a different category, date range or search term." />
        ) : (
          <div className="data-table-container sticky-first">
            <table className="w-full min-w-[60rem] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
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
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">{log.actorName}</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{log.actorRole}</p>
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

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">{log.ipAddress}</td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.reasonNotes ?? undefined}>
                      {log.reasonNotes || "Automated system trigger"}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {log.diff ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#FAF0F7] px-2.5 py-1 text-xs font-bold text-[#7A2B66] transition-colors hover:bg-[#3A102F] hover:text-white dark:bg-[#331A3B] dark:text-[#E9BFDF]"
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

      {/* State Diff Inspector */}
      <Sheet
        open={!!selectedLog && !!selectedLog.diff}
        onClose={() => setSelectedLog(null)}
        variant="center"
        widthClass="sm:max-w-2xl"
        bodyClassName="space-y-4 p-4 sm:p-6"
        header={
          selectedLog && (
            <div className="min-w-0">
              <h3 className="break-words text-base font-bold text-slate-900 dark:text-white">State Mutation Diff: {selectedLog.action}</h3>
              <p className="break-words text-xs text-slate-600 dark:text-slate-300">
                Target: {selectedLog.targetType} ({selectedLog.targetId}) • By {selectedLog.actorName}
              </p>
              {selectedLog.requestId && <p className="break-all font-mono text-[10px] text-slate-600 dark:text-slate-300">Request ID: {selectedLog.requestId}</p>}
            </div>
          )
        }
        footer={
          <div className="flex justify-end">
            <button type="button" onClick={() => setSelectedLog(null)} className="min-h-11 w-full rounded-xl bg-[#3A102F] px-5 py-2 text-xs font-bold text-white hover:bg-[#521A44] pointer-fine:min-h-10 sm:w-auto dark:bg-[#7A2B66] dark:hover:bg-[#A74490]">
              Close Inspector
            </button>
          </div>
        }
      >
        {selectedLog && selectedLog.diff && (
          <>
            <div className="grid grid-cols-1 gap-4 font-mono text-xs sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">Before State</span>
                <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-rose-300">{JSON.stringify(selectedLog.diff.before, null, 2)}</pre>
              </div>

              <div className="min-w-0 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">After State</span>
                <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-emerald-300">{JSON.stringify(selectedLog.diff.after, null, 2)}</pre>
              </div>
            </div>

            {selectedLog.reasonNotes && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-[#331A3B] dark:bg-[#211226]">
                <strong className="text-slate-700 dark:text-slate-300">Logged Justification: </strong>
                <span className="text-slate-600 dark:text-slate-400">{selectedLog.reasonNotes}</span>
              </div>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
};

