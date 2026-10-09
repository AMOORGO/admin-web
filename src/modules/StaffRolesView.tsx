"use client";

import React, { useMemo, useState } from "react";
import { UserPlus, Check, X, Loader2, Lock, Plus, Pencil, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { ChipTabs, PageHeader, SearchInput, SectionTabs, Toolbar } from "@/components/ui/Page";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { TableSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useMutation } from "@/lib/hooks/useMutation";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import { ApiPermissionGroup, ApiRole, ApiStaff, MODULE_LABELS, StaffMember, toStaffMember } from "@/lib/adapters/iam";
import { humanize } from "@/lib/format";

const inputClass =
  "w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white focus:outline-none";
const labelClass = "font-bold text-slate-700 dark:text-slate-300 block mb-1";

const ModalShell: React.FC<{ title: string; description?: string; wide?: boolean; onClose: () => void; children: React.ReactNode }> = ({ title, description, wide, onClose, children }) => (
  <Sheet
    open
    onClose={onClose}
    variant="center"
    widthClass={wide ? "sm:max-w-2xl" : "sm:max-w-md"}
    bodyClassName="space-y-4 p-4 sm:p-6"
    header={
      <div className="min-w-0">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{description}</p>}
      </div>
    }
  >
    {children}
  </Sheet>
);

/** Sticky action bar at the bottom of a ModalShell body (stays visible while the form scrolls; safe-area aware). */
const ModalFooter: React.FC<{ onCancel: () => void; onSubmit: () => void; submitLabel: string; pending: boolean; disabled?: boolean }> = ({
  onCancel,
  onSubmit,
  submitLabel,
  pending,
  disabled,
}) => (
  <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t border-[#F0E3ED] bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-[#331A3B] dark:bg-[#180D1C] sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
    <button type="button" onClick={onCancel} disabled={pending} className="min-h-11 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#28162E] pointer-fine:min-h-10">
      Cancel
    </button>
    <button
      type="button"
      onClick={onSubmit}
      disabled={pending || disabled}
      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3A102F] px-4 py-2 text-xs font-bold text-white hover:bg-[#521A44] disabled:opacity-40 dark:bg-[#7A2B66] dark:hover:bg-[#A74490] pointer-fine:min-h-10"
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {submitLabel}
    </button>
  </div>
);

export const StaffRolesView: React.FC = () => {
  const { user: me, can } = useAuth();
  const { cities, cityName } = useCities();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"STAFF" | "MATRIX">("STAFF");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const q = useDebouncedValue(search.trim(), 350);

  const staff = useCursorList<ApiStaff>("/admin/staff", { q, status: statusFilter === "ALL" ? undefined : statusFilter }, { limit: 25 });
  useOnInvalidate("staff", staff.refetch);

  // Role + permission catalogue (needed by the invite form, role editor and the matrix).
  const roles = useQuery<ApiRole[]>("roles", (signal) => api.get<ApiRole[]>("/admin/roles", { signal }));
  const catalogue = useQuery<ApiPermissionGroup[]>("permissions", (signal) => api.get<ApiPermissionGroup[]>("/admin/permissions", { signal }));
  useOnInvalidate("staff", roles.refetch);

  const members = useMemo(() => staff.items.map((s) => toStaffMember(s, cityName)), [staff.items, cityName]);

  // Dialog state
  const [showInvite, setShowInvite] = useState(false);
  const [editRolesFor, setEditRolesFor] = useState<StaffMember | null>(null);
  const [suspendFor, setSuspendFor] = useState<StaffMember | null>(null);
  const [reset2faFor, setReset2faFor] = useState<StaffMember | null>(null);
  const [revokeFor, setRevokeFor] = useState<StaffMember | null>(null);
  const [roleEditor, setRoleEditor] = useState<{ mode: "create" } | { mode: "edit"; role: ApiRole } | null>(null);
  const [deleteRole, setDeleteRole] = useState<ApiRole | null>(null);

  const refreshAll = () => {
    invalidate("staff");
    staff.refetch();
  };

  const roleList = roles.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Staff Management & Role-Based Access Control (RBAC)"
        description="Invite co-admins, configure regional scopes, enforce TOTP 2FA, and inspect granular permission matrix"
        actions={
          <Can permission="staff.create">
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="flex min-h-10 items-center gap-2 rounded-xl bg-[#3A102F] px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490]"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite Co-Admin
            </button>
          </Can>
        }
      />

      {/* Tabs */}
      <SectionTabs
        label="Staff sections"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: "STAFF", label: `Staff & Co-Admins${staff.items.length ? ` (${staff.items.length}${staff.hasMore ? "+" : ""})` : ""}` },
          { id: "MATRIX", label: "Roles & Permission Matrix" },
        ]}
      />

      {/* Tab 1: Staff List */}
      {activeTab === "STAFF" && (
        <div className="space-y-3">
          <Toolbar className="lg:flex lg:items-center lg:justify-between lg:space-y-0">
            <ChipTabs label="Staff status" items={["ALL", "ACTIVE", "INVITED", "SUSPENDED"].map((st) => ({ id: st, label: humanize(st) }))} value={statusFilter} onChange={setStatusFilter} />
            <SearchInput value={search} onValueChange={setSearch} placeholder="Search name or email..." className="lg:w-72" />
          </Toolbar>

          {staff.error && <ErrorBanner error={staff.error} title="Could not load staff" onRetry={staff.refetch} />}

          <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
            {staff.initialLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : members.length === 0 && !staff.error ? (
              <EmptyState title="No staff found" description="Adjust the filters, or invite a co-admin." />
            ) : (
              <div className="data-table-container sticky-first">
                <table className="w-full min-w-[53rem] text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Regional Scope</th>
                      <th className="py-3 px-4">2FA Status</th>
                      <th className="py-3 px-4">Last Activity</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Security Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                    {members.map((st) => {
                      const isSelf = st.id === me?.id;
                      return (
                        <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={st.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full border border-[#7A2B66] object-cover" />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {st.name}
                                  {isSelf && <span className="ml-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">(you)</span>}
                                </p>
                                <p className="max-w-[16rem] truncate text-[10px] text-slate-600 dark:text-slate-300" title={st.email}>{st.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {st.roles.length === 0 && (
                                <Badge variant="neutral" size="sm">
                                  No role
                                </Badge>
                              )}
                              {st.roles.map((r) => (
                                <Badge key={r.id} variant="plum" size="sm">
                                  {r.name}
                                </Badge>
                              ))}
                              {st.overrides.length > 0 && (
                                <Badge variant="warning" size="sm">
                                  +{st.overrides.length} override{st.overrides.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {st.cityScopeIds.length === 0 ? "All cities" : st.cityScope.join(", ")}
                          </td>

                          <td className="py-3 px-4">
                            {st.is2FAEnabled ? (
                              <Badge variant="teal" size="sm" dot>
                                TOTP Active
                              </Badge>
                            ) : (
                              <Badge variant="warning" size="sm">
                                Not Enrolled
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{st.lastLogin}</td>

                          <td className="py-3 px-4">
                            <Badge variant={st.status === "ACTIVE" ? "teal" : st.status === "INVITED" ? "warning" : "coral"} size="sm">
                              {st.status}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <Can permission="staff.manage">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setEditRolesFor(st)}
                                  className="min-h-10 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-[#211226] dark:text-slate-300 dark:hover:bg-[#28162E]"
                                >
                                  Roles
                                </button>
                                {st.status === "INVITED" ? (
                                  <ResendInviteButton staffId={st.id} onDone={refreshAll} />
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setReset2faFor(st)}
                                      className="min-h-10 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-[#211226] dark:text-slate-300 dark:hover:bg-[#28162E]"
                                      title="Reset 2FA Secret"
                                    >
                                      Reset 2FA
                                    </button>
                                    <button
                                      onClick={() => setRevokeFor(st)}
                                      className="min-h-10 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-[#211226] dark:text-slate-300 dark:hover:bg-[#28162E]"
                                      title="Sign this person out everywhere"
                                    >
                                      Revoke sessions
                                    </button>
                                  </>
                                )}
                                {!isSelf && st.status !== "INVITED" && (
                                  <button
                                    onClick={() => setSuspendFor(st)}
                                    className={`min-h-10 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                      st.status === "ACTIVE"
                                        ? "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    }`}
                                  >
                                    {st.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                                  </button>
                                )}
                              </div>
                            </Can>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <LoadMore hasMore={staff.hasMore} loading={staff.loadingMore} onClick={staff.loadMore} />
          </div>
        </div>
      )}

      {/* Tab 2: RBAC Matrix */}
      {activeTab === "MATRIX" && (
        <RoleMatrix
          roles={roleList}
          catalogue={catalogue.data ?? []}
          loading={roles.initialLoading || catalogue.initialLoading}
          error={roles.error ?? catalogue.error}
          onRetry={() => {
            roles.refetch();
            catalogue.refetch();
          }}
          canManageRoles={can("roles.manage")}
          onCreate={() => setRoleEditor({ mode: "create" })}
          onEdit={(role) => setRoleEditor({ mode: "edit", role })}
          onDelete={setDeleteRole}
        />
      )}

      {/* Invite Co-Admin Modal */}
      {showInvite && (
        <InviteModal
          roles={roleList}
          cities={cities.map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setShowInvite(false)}
          onDone={(email) => {
            setShowInvite(false);
            toast.success(`Invitation sent to ${email}`);
            refreshAll();
          }}
        />
      )}

      {editRolesFor && (
        <EditRolesModal
          member={editRolesFor}
          roles={roleList}
          onClose={() => setEditRolesFor(null)}
          onDone={() => {
            toast.success(`Roles updated for ${editRolesFor.name}`);
            setEditRolesFor(null);
            refreshAll();
          }}
        />
      )}

      {roleEditor && (
        <RoleEditorModal
          existing={roleEditor.mode === "edit" ? roleEditor.role : null}
          catalogue={catalogue.data ?? []}
          myPermissions={me?.permissions ?? []}
          isSuper={(me?.roles ?? []).includes("SUPER_ADMIN")}
          onClose={() => setRoleEditor(null)}
          onDone={(name, created) => {
            toast.success(created ? `Role "${name}" created` : `Role "${name}" updated`);
            setRoleEditor(null);
            roles.refetch();
            invalidate("staff");
          }}
        />
      )}

      {/* Suspend / Reactivate */}
      {suspendFor && (
        <ConfirmDialog
          isOpen
          title={suspendFor.status === "ACTIVE" ? "Suspend Staff Access" : "Reactivate Staff Account"}
          description={
            suspendFor.status === "ACTIVE"
              ? `Suspending ${suspendFor.name} will immediately invalidate active session tokens and block admin panel login.`
              : `Reactivating ${suspendFor.name} will restore staff access.`
          }
          targetEntityLabel={suspendFor.name}
          confirmText={suspendFor.status === "ACTIVE" ? "Confirm Suspension" : "Confirm Reactivation"}
          isDestructive={suspendFor.status === "ACTIVE"}
          minReasonLength={3}
          reasonPlaceholder="Specify administrative reason..."
          onConfirm={async (reason) => {
            const action = suspendFor.status === "ACTIVE" ? "suspend" : "reactivate";
            await api.post(`/admin/staff/${suspendFor.id}/${action}`, { reason });
            toast.success(action === "suspend" ? `${suspendFor.name} suspended` : `${suspendFor.name} reactivated`);
            setSuspendFor(null);
            refreshAll();
          }}
          onCancel={() => setSuspendFor(null)}
        />
      )}

      {/* Reset 2FA */}
      {reset2faFor && (
        <ConfirmDialog
          isOpen
          title="Reset Two-Factor Authentication"
          description={`Resetting 2FA for ${reset2faFor.name} will require them to scan a new TOTP QR code upon next login.`}
          targetEntityLabel={reset2faFor.name}
          confirmText="Reset 2FA Secret"
          isDestructive={false}
          minReasonLength={3}
          reasonPlaceholder="Specify reason (e.g. Lost device verified via security interview)..."
          onConfirm={async (reason) => {
            await api.post(`/admin/staff/${reset2faFor.id}/reset-2fa`, { reason });
            toast.success(`2FA reset for ${reset2faFor.name}`);
            setReset2faFor(null);
            refreshAll();
          }}
          onCancel={() => setReset2faFor(null)}
        />
      )}

      {/* Revoke sessions */}
      {revokeFor && (
        <ConfirmDialog
          isOpen
          title="Revoke All Sessions"
          description={`${revokeFor.name} will be signed out of every device and must sign in again.`}
          targetEntityLabel={revokeFor.name}
          confirmText="Revoke Sessions"
          isDestructive
          requireReason={false}
          onConfirm={async () => {
            await api.post(`/admin/staff/${revokeFor.id}/revoke-sessions`, {});
            toast.success(`Sessions revoked for ${revokeFor.name}`);
            setRevokeFor(null);
            refreshAll();
          }}
          onCancel={() => setRevokeFor(null)}
        />
      )}

      {/* Delete custom role */}
      {deleteRole && (
        <ConfirmDialog
          isOpen
          title="Delete Custom Role"
          description={`Delete the role "${deleteRole.name}". Roles that are still assigned to staff cannot be deleted.`}
          targetEntityLabel={deleteRole.name}
          confirmText="Delete Role"
          minReasonLength={3}
          onConfirm={async (reason) => {
            await api.delete(`/admin/roles/${deleteRole.id}`, { query: { reason } });
            toast.success(`Role "${deleteRole.name}" deleted`);
            setDeleteRole(null);
            roles.refetch();
            invalidate("staff");
          }}
          onCancel={() => setDeleteRole(null)}
        />
      )}
    </div>
  );
};

// ── Resend invite ───────────────────────────────────────────

const ResendInviteButton: React.FC<{ staffId: string; onDone: () => void }> = ({ staffId, onDone }) => {
  const toast = useToast();
  const m = useMutation(() => api.post(`/admin/staff/${staffId}/resend-invite`, {}));
  return (
    <button
      disabled={m.pending}
      onClick={async () => {
        const res = await m.run();
        if (res.ok) {
          toast.success("Invitation re-sent");
          onDone();
        } else toast.error(res.error);
      }}
      className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-[#211226] text-slate-700 dark:text-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-[#28162E] disabled:opacity-50"
    >
      {m.pending && <Loader2 className="h-3 w-3 animate-spin" />}
      Resend invite
    </button>
  );
};

// ── Invite modal ────────────────────────────────────────────

const InviteModal: React.FC<{
  roles: ApiRole[];
  cities: { id: string; name: string }[];
  onClose: () => void;
  onDone: (email: string) => void;
}> = ({ roles, cities, onClose, onDone }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const effectiveRole = roleKey || roles.find((r) => r.key === "OPERATIONS_ADMIN")?.key || roles[0]?.key || "";

  const invite = useMutation(() =>
    api.post<ApiStaff>("/admin/staff", {
      name: name.trim(),
      email: email.trim(),
      roleKeys: [effectiveRole],
      cityScope: cityIds,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    }),
  );

  const submit = async () => {
    const res = await invite.run();
    if (res.ok) onDone(email.trim());
  };

  return (
    <ModalShell onClose={onClose} title="Invite Co-Administrator" description="An activation link is e-mailed. The invitee chooses a password and must enrol two-factor authentication on first sign-in.">
      <div className="space-y-3 text-xs">
        <div>
          <label className={labelClass} htmlFor="invite-name">
            Full Name
          </label>
          <input id="invite-name" type="text" placeholder="e.g. Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="invite-email">
            Work Email
          </label>
          <input id="invite-email" type="email" placeholder="jordan.lee@amoorgo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="invite-role">
            Administrative Role
          </label>
          <select id="invite-role" value={effectiveRole} onChange={(e) => setRoleKey(e.target.value)} className={`${inputClass} cursor-pointer font-semibold`}>
            {roles.map((r) => (
              <option key={r.id} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelClass}>City Scope Restriction</span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">Leave all unchecked for global access.</p>
          {cities.length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">No cities available.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#331A3B] px-2.5 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cityIds.includes(c.id)}
                    onChange={(e) => setCityIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))}
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="invite-reason">
            Reason <span className="font-normal text-slate-500 dark:text-slate-400">(optional, audit log)</span>
          </label>
          <input id="invite-reason" type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </div>
      </div>
      {invite.error && <ErrorBanner error={invite.error} title="Invitation failed" />}
      <ModalFooter onCancel={onClose} onSubmit={submit} submitLabel="Send Staff Invitation" pending={invite.pending} disabled={name.trim().length < 2 || !email.trim() || !effectiveRole} />
    </ModalShell>
  );
};

// ── Edit roles modal ────────────────────────────────────────

const EditRolesModal: React.FC<{ member: StaffMember; roles: ApiRole[]; onClose: () => void; onDone: () => void }> = ({ member, roles, onClose, onDone }) => {
  const [selected, setSelected] = useState<string[]>(member.roles.map((r) => r.key));
  const [reason, setReason] = useState("");
  const save = useMutation(() => api.put(`/admin/staff/${member.id}/roles`, { roleKeys: selected, reason: reason.trim() }));

  const submit = async () => {
    const res = await save.run();
    if (res.ok) onDone();
  };

  return (
    <ModalShell onClose={onClose} title={`Roles for ${member.name}`} description="Effective permissions are the union of the selected roles (plus any per-user overrides). Changes apply to new sessions immediately.">
      <div className="space-y-2 text-xs">
        {roles.length === 0 && <Skeleton className="h-20 w-full" />}
        {roles.map((r) => (
          <label key={r.id} className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-[#331A3B] p-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#28162E]/40">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.includes(r.key)}
              onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, r.key] : prev.filter((x) => x !== r.key)))}
            />
            <span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{r.name}</span>
              {r.description && <span className="block text-[11px] text-slate-500 dark:text-slate-400">{r.description}</span>}
            </span>
          </label>
        ))}
        <div>
          <label className={labelClass} htmlFor="roles-reason">
            Reason <span className="text-[#D93320] dark:text-[#FF7361]">*</span>
          </label>
          <textarea id="roles-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Why is access changing? (min. 3 characters)" />
        </div>
      </div>
      {save.error && <ErrorBanner error={save.error} title="Could not update roles" />}
      <ModalFooter onCancel={onClose} onSubmit={submit} submitLabel="Save Roles" pending={save.pending} disabled={selected.length === 0 || reason.trim().length < 3} />
    </ModalShell>
  );
};

// ── Role matrix ─────────────────────────────────────────────

const RoleMatrix: React.FC<{
  roles: ApiRole[];
  catalogue: ApiPermissionGroup[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  canManageRoles: boolean;
  onCreate: () => void;
  onEdit: (role: ApiRole) => void;
  onDelete: (role: ApiRole) => void;
}> = ({ roles, catalogue, loading, error, onRetry, canManageRoles, onCreate, onEdit, onDelete }) => {
  const rows = useMemo(() => catalogue.flatMap((g) => g.permissions.map((p) => ({ ...p, module: g.module }))), [catalogue]);
  const roleSets = useMemo(() => new Map(roles.map((r) => [r.key, new Set(r.permissions)])), [roles]);

  return (
    <div className="space-y-3">
      {Boolean(error) && <ErrorBanner error={error} title="Could not load roles" onRetry={onRetry} />}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/40 flex flex-wrap justify-between items-center gap-2 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-200">Role Permission Capabilities (live from the permission catalogue)</span>
          <span className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> requires mandatory 2FA
            </span>
            {canManageRoles && (
              <button onClick={onCreate} className="flex items-center gap-1 rounded-lg bg-[#3A102F] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#521A44] dark:bg-[#7A2B66]">
                <Plus className="h-3 w-3" /> New custom role
              </button>
            )}
          </span>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : (
          <div className="data-table-container sticky-first">
            <table className="w-full min-w-[44rem] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-72">Permission Key</th>
                  {roles.map((r) => (
                    <th key={r.id} className="py-3 px-4 text-center whitespace-nowrap">
                      <div>{r.name}</div>
                      <div className="font-normal normal-case text-slate-500 dark:text-slate-400">{r.userCount} staff</div>
                      {canManageRoles && !r.isSystem && (
                        <div className="mt-1 flex justify-center gap-1">
                          <button onClick={() => onEdit(r)} className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]" aria-label={`Edit ${r.name}`}>
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => onDelete(r)} className="rounded p-1 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40" aria-label={`Delete ${r.name}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {rows.map((p) => (
                  <tr key={p.key} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">{p.description}</span>
                      {p.sensitive && <Lock className="ml-1.5 inline h-3 w-3 text-amber-700 dark:text-amber-400" aria-label="Sensitive: mandatory 2FA" />}
                      <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {MODULE_LABELS[p.module] ?? humanize(p.module)} · {p.key}
                      </p>
                    </td>
                    {roles.map((r) => (
                      <td key={r.id} className="py-3 px-4 text-center">
                        {roleSets.get(r.key)?.has(p.key) ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:text-slate-400 dark:bg-[#211226]">
                            <X className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Create / edit custom role ───────────────────────────────

const RoleEditorModal: React.FC<{
  existing: ApiRole | null;
  catalogue: ApiPermissionGroup[];
  myPermissions: string[];
  isSuper: boolean;
  onClose: () => void;
  onDone: (name: string, created: boolean) => void;
}> = ({ existing, catalogue, myPermissions, isSuper, onClose, onDone }) => {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [perms, setPerms] = useState<string[]>(existing?.permissions ?? []);
  const [reason, setReason] = useState("");

  const save = useMutation(() => {
    const body = { name: name.trim(), description: description.trim(), permissions: perms, reason: reason.trim() };
    return existing ? api.patch(`/admin/roles/${existing.id}`, body) : api.post("/admin/roles", body);
  });

  const submit = async () => {
    const res = await save.run();
    if (res.ok) onDone(name.trim(), !existing);
  };

  // A non-super editor can only grant what they hold, and never the Super-Admin-only set.
  const grantable = (p: { key: string; superAdminOnly: boolean }) => isSuper || (myPermissions.includes(p.key) && !p.superAdminOnly);

  return (
    <ModalShell onClose={onClose} wide title={existing ? `Edit role: ${existing.name}` : "New custom role"} description="Custom roles are permission sets. System roles are read-only.">
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="role-name">
              Name
            </label>
            <input id="role-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Night Shift Lead" />
          </div>
          <div>
            <label className={labelClass} htmlFor="role-desc">
              Description
            </label>
            <input id="role-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="space-y-3 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#331A3B] p-3">
          {catalogue.map((g) => (
            <div key={g.module}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{MODULE_LABELS[g.module] ?? humanize(g.module)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {g.permissions.map((p) => {
                  const ok = grantable(p);
                  return (
                    <label key={p.key} className={`flex items-start gap-2 rounded-lg p-1.5 ${ok ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-[#28162E]/40" : "opacity-50"}`} title={ok ? undefined : "You cannot grant this permission"}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={!ok}
                        checked={perms.includes(p.key)}
                        onChange={(e) => setPerms((prev) => (e.target.checked ? [...prev, p.key] : prev.filter((x) => x !== p.key)))}
                      />
                      <span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{p.description}</span>
                        <span className="block font-mono text-[10px] text-slate-500 dark:text-slate-400">{p.key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className={labelClass} htmlFor="role-reason">
            Reason <span className="text-[#D93320] dark:text-[#FF7361]">*</span>
          </label>
          <input id="role-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Audit justification (min. 3 characters)" />
        </div>
      </div>
      {save.error && <ErrorBanner error={save.error} title="Could not save role" />}
      <ModalFooter onCancel={onClose} onSubmit={submit} submitLabel={existing ? "Save Role" : "Create Role"} pending={save.pending} disabled={name.trim().length < 2 || perms.length === 0 || reason.trim().length < 3} />
    </ModalShell>
  );
};

