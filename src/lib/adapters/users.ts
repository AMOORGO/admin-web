import type { Rider } from "@/types";
import { avatarFor, minorToMajor } from "@/lib/format";

/** Backend `UserStatus` enum. */
export type ApiUserStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED" | "DELETION_PENDING" | "DELETED";

/** GET /admin/users item (also the head of GET /admin/users/:id). Money in minor units. */
export interface ApiUserRow {
  id: string;
  /** "—" when the rider has not completed their profile */
  name: string;
  phone: string;
  email: string | null;
  status: ApiUserStatus;
  flagged: boolean;
  rating: number;
  ratingCount: number;
  totalRides: number;
  lifetimeSpendMinor: number;
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface ApiEmergencyContact {
  name: string;
  phone: string;
  relation: string | null;
}

export interface ApiSavedPlace {
  label: string;
  address: string;
}

/** GET /admin/users/:id (also returned by PATCH / suspend / reactivate). */
export interface ApiUserDetail extends ApiUserRow {
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  locale: string | null;
  photoUrl: string | null;
  statusReason: string | null;
  profileComplete: boolean;
  referralCode: string | null;
  referredByUserId: string | null;
  termsAcceptedAt: string | null;
  emergencyContacts: ApiEmergencyContact[];
  savedPlaces: ApiSavedPlace[];
  devices: { platform: string | null; appVersion: string | null; model: string | null; lastSeenAt: string | null }[];
  consents: { type: string; version: string; accepted: boolean; createdAt: string }[];
  deletionRequest: { status: string; scheduledFor: string | null; blockedReason: string | null } | null;
}

/** GET /admin/ledger/accounts item (finance.view). */
export interface ApiLedgerAccount {
  id: string;
  type: string;
  ownerId: string | null;
  currency: string;
  balanceMinor: number;
  updatedAt: string;
}

/** POST /admin/wallets/:userId/adjust */
export interface ApiWalletAdjustResult {
  userId: string;
  balanceMinor: number;
}

/** Rider as shown in the directory. Extends the UI type with what the API really provides. */
export interface RiderView extends Rider {
  /** Raw account status (the UI `status` collapses it to ACTIVE | SUSPENDED | FLAGGED). */
  accountStatus: ApiUserStatus;
  flagged: boolean;
  ratingCount: number;
  lastActiveAt: string | null;
}

export interface RiderDetailView extends RiderView {
  statusReason: string | null;
  emergencyContacts: ApiEmergencyContact[];
  profileComplete: boolean;
  locale: string | null;
  devices: ApiUserDetail["devices"];
  deletionRequest: ApiUserDetail["deletionRequest"];
}

export function toRider(u: ApiUserRow): RiderView {
  const name = u.name && u.name !== "—" ? u.name : "Unnamed rider";
  const status: Rider["status"] = u.status !== "ACTIVE" ? "SUSPENDED" : u.flagged ? "FLAGGED" : "ACTIVE";
  return {
    id: u.id,
    name,
    phone: u.phone,
    email: u.email ?? "",
    // The backend has no city on riders, no wallet balance on the list and no emergency contact on the row.
    city: "",
    avatar: avatarFor(name),
    rating: u.rating,
    totalRides: u.totalRides,
    lifetimeSpend: minorToMajor(u.lifetimeSpendMinor),
    walletBalance: 0,
    status,
    joinedAt: u.joinedAt,
    emergencyContact: { name: "", phone: "", relation: "" },
    savedPlaces: [],
    accountStatus: u.status,
    flagged: u.flagged,
    ratingCount: u.ratingCount,
    lastActiveAt: u.lastActiveAt,
  };
}

export function toRiderDetail(u: ApiUserDetail): RiderDetailView {
  const base = toRider(u);
  const first = u.emergencyContacts[0];
  return {
    ...base,
    savedPlaces: u.savedPlaces.map((p) => ({ name: p.label, address: p.address })),
    emergencyContact: first ? { name: first.name, phone: first.phone, relation: first.relation ?? "" } : base.emergencyContact,
    statusReason: u.statusReason,
    emergencyContacts: u.emergencyContacts,
    profileComplete: u.profileComplete,
    locale: u.locale,
    devices: u.devices,
    deletionRequest: u.deletionRequest,
  };
}

/** Maps the directory's status chips onto the list endpoint's filters. */
export function statusFilterQuery(filter: "ALL" | "ACTIVE" | "FLAGGED" | "SUSPENDED"): { status?: ApiUserStatus; flagged?: boolean } {
  switch (filter) {
    case "ACTIVE":
      return { status: "ACTIVE" };
    case "SUSPENDED":
      return { status: "SUSPENDED" };
    case "FLAGGED":
      return { flagged: true };
    default:
      return {};
  }
}
