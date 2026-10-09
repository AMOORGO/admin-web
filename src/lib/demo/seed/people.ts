/** Seed: staff, roles, permission catalogue, riders, captains (vehicles, documents, Second Chance records). */
import type { StaffMe } from "../../auth/types";
import type {
  ApiAvailability,
  ApiCaptainDetail,
  ApiCaptainStatus,
  ApiDocumentStatus,
  ApiStaffDocument,
  ApiVehicle,
} from "../../adapters/captains";
import type { ApiPermissionGroup, ApiRole, ApiStaff } from "../../adapters/iam";
import type { ApiScDetail, ApiScStatus, ApiScTier } from "../../adapters/secondChance";
import type { ApiUserDetail, ApiUserStatus } from "../../adapters/users";
import type { PermissionKey } from "@/types";
import type { CaptainRow } from "../store";
import { DOC_META, labelFor, maskNumber, refreshDerived } from "../logic/captain";
import { DAY, HOUR, MIN, iso, isoDate, maskedPhone, mulberry32, pick, randFloat, randInt, refCode, uuid } from "../util";

const r = mulberry32(202);

// ── Permissions & roles ──

/** Exhaustive over `PermissionKey`: adding a key to the type without describing it here is a compile error. */
const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "dashboard.view": "View operational dashboard and KPIs",
  "rides.view": "View rides, timelines, live map",
  "rides.reassign": "Manually assign or reassign a captain",
  "rides.cancel": "Cancel a ride on behalf of the platform",
  "rides.adjust_fare": "Adjust a ride fare (audited, limit-gated)",
  "rides.change_status": "Force a ride status change (exceptional)",
  "users.view": "View passengers",
  "users.edit": "Edit passenger information",
  "users.suspend": "Suspend / reactivate passengers",
  "captains.view": "View captains and applications",
  "captains.edit": "Edit captain profile / eligibility",
  "captains.approve": "Approve or reject captain applications",
  "captains.review_docs": "Review captain documents",
  "captains.suspend": "Suspend / reactivate captains",
  "second_chance.manage": "Manage Second Chance Driver program",
  "finance.view": "View payments, transactions, ledger",
  "finance.refund": "Issue refunds within limit",
  "finance.refund_approve": "Approve manual / above-limit refunds",
  "finance.payouts": "Manage payouts and batches",
  "promotions.manage": "Manage coupons, referrals, incentive campaigns",
  "ratings.moderate": "Moderate ratings and reviews",
  "support.manage": "Work support tickets",
  "safety.manage": "Handle SOS and safety incidents",
  "notifications.manage": "Manage templates and view delivery history",
  "config.view": "View platform configuration",
  "config.edit": "Edit platform configuration, cities, zones, pricing",
  "staff.view": "View staff accounts",
  "staff.create": "Invite staff",
  "staff.manage": "Edit, suspend, reset 2FA, revoke sessions",
  "roles.manage": "Create and edit roles and permission sets",
  "audit.view": "View the audit log",
  "reports.export": "Run and export reports",
  "system.view": "View system health, integrations and errors",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_DESCRIPTIONS) as PermissionKey[];

const SENSITIVE: PermissionKey[] = ["finance.refund_approve", "finance.payouts", "config.edit", "staff.create", "staff.manage", "roles.manage", "rides.adjust_fare"];
const SUPER_ADMIN_ONLY: PermissionKey[] = ["staff.create", "staff.manage", "roles.manage", "config.edit"];

const SYSTEM_ROLES: Array<{ key: string; name: string; description: string; permissions: PermissionKey[] }> = [
  { key: "SUPER_ADMIN", name: "Super Admin", description: "Full access to everything, including staff and configuration", permissions: ALL_PERMISSIONS },
  {
    key: "OPERATIONS_ADMIN",
    name: "Operations Admin",
    description: "Runs day-to-day operations: rides, users, captains, support, limited config",
    permissions: [
      "dashboard.view", "rides.view", "rides.reassign", "rides.cancel", "rides.adjust_fare", "rides.change_status",
      "users.view", "users.edit", "users.suspend",
      "captains.view", "captains.edit", "captains.approve", "captains.review_docs", "captains.suspend", "second_chance.manage",
      "finance.view", "safety.manage", "support.manage", "ratings.moderate", "notifications.manage",
      "config.view", "audit.view", "reports.export", "system.view",
    ],
  },
  {
    key: "CAPTAIN_OPS",
    name: "Captain Ops",
    description: "Captain onboarding, KYC and eligibility",
    permissions: [
      "dashboard.view", "captains.view", "captains.edit", "captains.approve", "captains.review_docs", "captains.suspend",
      "second_chance.manage", "rides.view", "rides.reassign", "safety.manage", "support.manage", "audit.view",
    ],
  },
  {
    key: "FINANCE_ADMIN",
    name: "Finance Admin",
    description: "Payments, refunds, payouts, settlement, finance config",
    permissions: [
      "dashboard.view", "finance.view", "finance.refund", "finance.refund_approve", "finance.payouts", "rides.view", "rides.adjust_fare",
      "users.view", "captains.view", "config.view", "audit.view", "reports.export", "promotions.manage",
    ],
  },
  {
    key: "SUPPORT_AGENT",
    name: "Support Agent",
    description: "Helpdesk, refunds within limit, safety triage",
    permissions: ["dashboard.view", "users.view", "captains.view", "rides.view", "support.manage", "finance.refund", "safety.manage", "ratings.moderate"],
  },
  {
    key: "READ_ONLY",
    name: "Read Only",
    description: "View-only access to operational data",
    permissions: ["dashboard.view", "rides.view", "users.view", "captains.view", "finance.view", "audit.view"],
  },
];

export function permissionCatalogue(): ApiPermissionGroup[] {
  const groups = new Map<string, ApiPermissionGroup>();
  for (const key of ALL_PERMISSIONS) {
    const moduleName = key.split(".")[0];
    const g = groups.get(moduleName) ?? { module: moduleName, permissions: [] };
    g.permissions.push({ key, description: PERMISSION_DESCRIPTIONS[key], sensitive: SENSITIVE.includes(key), superAdminOnly: SUPER_ADMIN_ONLY.includes(key) });
    groups.set(moduleName, g);
  }
  return [...groups.values()];
}

export interface PeopleSeed {
  me: StaffMe;
  staff: ApiStaff[];
  roles: ApiRole[];
  permissionCatalogue: ApiPermissionGroup[];
  riders: ApiUserDetail[];
  captains: CaptainRow[];
}

// ── Staff ──

const STAFF_DEFS: Array<{ name: string; email: string; role: string; scope: string[]; totp: boolean; status: ApiStaff["status"]; lastLoginMin: number | null }> = [
  { name: "Elena Rostova", email: "elena.ops@amoorgo.com", role: "OPERATIONS_ADMIN", scope: ["austin", "dallas"], totp: true, status: "ACTIVE", lastLoginMin: 24 },
  { name: "Marcus Vance", email: "marcus.fleet@amoorgo.com", role: "CAPTAIN_OPS", scope: ["austin"], totp: true, status: "ACTIVE", lastLoginMin: 130 },
  { name: "Amina Patel", email: "amina.finance@amoorgo.com", role: "FINANCE_ADMIN", scope: [], totp: true, status: "ACTIVE", lastLoginMin: 300 },
  { name: "Devon Chen", email: "devon.support@amoorgo.com", role: "SUPPORT_AGENT", scope: [], totp: false, status: "ACTIVE", lastLoginMin: 1440 },
  { name: "Priya Raman", email: "priya.analyst@amoorgo.com", role: "READ_ONLY", scope: ["austin", "dallas", "houston"], totp: false, status: "ACTIVE", lastLoginMin: 2880 },
  { name: "Jordan Lee", email: "jordan.lee@amoorgo.com", role: "OPERATIONS_ADMIN", scope: ["houston"], totp: false, status: "INVITED", lastLoginMin: null },
  { name: "Tomas Becker", email: "tomas.becker@amoorgo.com", role: "SUPPORT_AGENT", scope: [], totp: true, status: "SUSPENDED", lastLoginMin: 14400 },
];

export const DEMO_STAFF_ID = "d3a10000-0000-4000-8000-000000000001";

// ── Rider names ──

const RIDER_NAMES = [
  "Sophia Martinez", "Liam O'Connor", "Hannah Becker", "Chloe Dupont", "Grace Kim", "Noah Williams", "Olivia Johnson", "Ethan Brown",
  "Emma Davis", "Lucas Garcia", "Ava Rodriguez", "Mason Wilson", "Isabella Moore", "Logan Taylor", "Mia Anderson", "Jacob Thomas",
  "Amelia Jackson", "Elijah White", "Harper Harris", "Benjamin Martin", "Evelyn Thompson", "Daniel Lee", "Abigail Clark", "Henry Lewis",
  "Emily Robinson", "Sebastian Walker", "Madison Young", "Jack Allen", "Scarlett King", "Owen Wright",
];
const AREA_CODES = ["512", "737", "214", "713", "469", "832"];
const MAIL = ["gmail.com", "outlook.com", "icloud.com", "yahoo.com", "proton.me"];
const HOME_ADDRESSES = [
  "1100 Congress Ave, Austin, TX 78701", "2200 S Lamar Blvd, Austin, TX 78704", "4500 Duval St, Austin, TX 78751", "1600 E 6th St, Austin, TX 78702",
  "11410 Century Oaks Terrace, Austin, TX 78758", "3300 McKinney Ave, Dallas, TX 75204", "1200 Main St, Houston, TX 77002",
];
const WORK_ADDRESSES = ["500 W 2nd St, Austin, TX 78701", "300 W Riverside Dr, Austin, TX 78704", "2901 S Capital of Texas Hwy, Austin, TX 78746", "1 University Station, Austin, TX 78712"];

function seedRiders(now: number): ApiUserDetail[] {
  return RIDER_NAMES.map((name, i) => {
    const [first, ...rest] = name.split(" ");
    const last = rest.join(" ");
    const joinedAgo = randInt(r, 20, 520) * DAY;
    const status: ApiUserStatus = i === 11 ? "SUSPENDED" : i === 23 ? "BLOCKED" : i === 29 ? "DELETION_PENDING" : "ACTIVE";
    const flagged = i === 4 || i === 17 || i === 11;
    const totalRides = randInt(r, 3, 160);
    const area = pick(r, AREA_CODES);
    const complete = i !== 28;
    return {
      id: uuid(r),
      name: complete ? name : "—",
      phone: maskedPhone(area, String(randInt(r, 1000, 9999))),
      email: complete ? `${first}.${last.replace(/[^A-Za-z]/g, "")}${randInt(r, 1, 99)}@${pick(r, MAIL)}`.toLowerCase() : null,
      status,
      flagged,
      rating: Math.round(randFloat(r, 4.5, 5) * 100) / 100,
      ratingCount: Math.max(1, Math.round(totalRides * 0.7)),
      totalRides,
      lifetimeSpendMinor: Math.round(totalRides * randFloat(r, 1500, 2800)),
      joinedAt: iso(now - joinedAgo),
      lastActiveAt: iso(now - randInt(r, 5, 60 * 24 * 6) * MIN),
      firstName: complete ? first : null,
      lastName: complete ? last : null,
      dateOfBirth: complete ? `${randInt(r, 1968, 2003)}-${String(randInt(r, 1, 12)).padStart(2, "0")}-${String(randInt(r, 1, 28)).padStart(2, "0")}` : null,
      locale: "en-US",
      photoUrl: null,
      statusReason:
        status === "SUSPENDED" ? "Repeated no-shows and unpaid cancellation fees"
        : status === "BLOCKED" ? "Fraudulent chargeback confirmed by Stripe"
        : status === "DELETION_PENDING" ? "Account deletion requested by the user"
        : null,
      profileComplete: complete,
      referralCode: `${first.slice(0, 4).toUpperCase()}${refCode(r, 3)}`,
      referredByUserId: null,
      termsAcceptedAt: iso(now - joinedAgo),
      emergencyContacts: complete
        ? [{ name: `${pick(r, ["Carlos", "Fiona", "Priya", "Marcus", "Dana", "Luis", "Jenna"])} ${last}`, phone: maskedPhone(area, String(randInt(r, 1000, 9999))), relation: pick(r, ["Spouse", "Parent", "Sibling", "Friend", "Partner"]) }]
        : [],
      savedPlaces: complete
        ? [
            { label: "Home", address: pick(r, HOME_ADDRESSES) },
            { label: "Work", address: pick(r, WORK_ADDRESSES) },
          ]
        : [],
      devices: [
        { platform: i % 3 === 0 ? "ANDROID" : "IOS", appVersion: "2.4.1", model: i % 3 === 0 ? "Pixel 8" : "iPhone 15", lastSeenAt: iso(now - randInt(r, 5, 900) * MIN) },
      ],
      consents: [
        { type: "TERMS", version: "2025-09", accepted: true, createdAt: iso(now - joinedAgo) },
        { type: "PRIVACY", version: "2025-09", accepted: true, createdAt: iso(now - joinedAgo) },
        { type: "MARKETING", version: "2025-09", accepted: i % 2 === 0, createdAt: iso(now - joinedAgo) },
      ],
      deletionRequest: status === "DELETION_PENDING" ? { status: "PENDING", scheduledFor: iso(now + 9 * DAY), blockedReason: null } : null,
    };
  });
}

// ── Captains ──

type SecondChanceKind = null | "T1" | "T2" | "T3" | "APPLIED" | "REVIEW" | "SUSPENDED" | "REVOKED";

interface CaptainDef {
  name: string;
  city: 0 | 1 | 2;
  status: ApiCaptainStatus;
  availability: ApiAvailability;
  vehicle: [string, string, number, string, boolean];
  sc: SecondChanceKind;
  prime?: boolean;
}

const CAPTAIN_DEFS: CaptainDef[] = [
  { name: "David K. Okafor", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Hyundai", "Ioniq 5", 2023, "Lunar White", true], sc: null },
  { name: "Mateo Rodriguez", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Tesla", "Model Y", 2023, "Midnight Silver", true], sc: null },
  { name: "James Carter", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Toyota", "Camry", 2021, "Black", false], sc: null },
  { name: "Aarav Sharma", city: 0, status: "APPROVED", availability: "ONLINE", vehicle: ["Toyota", "Prius", 2022, "Blue", false], sc: null },
  { name: "Maya Lin", city: 0, status: "APPROVED", availability: "ONLINE", vehicle: ["Honda", "Accord", 2022, "Silver", false], sc: null },
  { name: "Darnell Washington", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Kia", "EV6", 2023, "Gray", true], sc: null },
  { name: "Kavita Rao", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Kia", "EV6 GT", 2024, "Red", true], sc: null },
  { name: "Luis Fernandez", city: 0, status: "APPROVED", availability: "ONLINE", vehicle: ["Chevrolet", "Malibu", 2020, "White", false], sc: null },
  { name: "Tasha Brooks", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Nissan", "Altima", 2022, "Gray", false], sc: null },
  { name: "Omar Haddad", city: 0, status: "APPROVED", availability: "ONLINE", vehicle: ["Hyundai", "Sonata", 2021, "Black", false], sc: null },
  { name: "Priscilla Nguyen", city: 0, status: "APPROVED", availability: "ONLINE", vehicle: ["Mercedes-Benz", "E-Class", 2022, "Black", false], sc: null, prime: true },
  { name: "Ethan Walker", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Cadillac", "CT5", 2023, "Black", false], sc: null, prime: true },
  { name: "Rosa Delgado", city: 0, status: "APPROVED", availability: "ON_RIDE", vehicle: ["Toyota", "Corolla", 2021, "Red", false], sc: null },
  { name: "Brandon Hughes", city: 0, status: "APPROVED", availability: "OFFLINE", vehicle: ["Ford", "Fusion", 2019, "Gray", false], sc: "T2" },
  { name: "Fatima Zahra", city: 0, status: "SUBMITTED", availability: "OFFLINE", vehicle: ["Honda", "Civic", 2022, "Blue", false], sc: null },
  { name: "Kevin O'Brien", city: 0, status: "SUBMITTED", availability: "OFFLINE", vehicle: ["Toyota", "RAV4", 2021, "White", false], sc: "APPLIED" },
  { name: "Naomi Fields", city: 0, status: "UNDER_REVIEW", availability: "OFFLINE", vehicle: ["Tesla", "Model 3", 2022, "White", true], sc: null },
  { name: "Victor Alvarez", city: 0, status: "UNDER_REVIEW", availability: "OFFLINE", vehicle: ["Nissan", "Sentra", 2020, "Silver", false], sc: "REVIEW" },
  { name: "Robert MacIntyre", city: 1, status: "APPROVED", availability: "OFFLINE", vehicle: ["Toyota", "Camry Hybrid", 2022, "Silver", false], sc: null },
  { name: "Jasmine Carter", city: 1, status: "APPROVED", availability: "OFFLINE", vehicle: ["Honda", "Accord", 2023, "Gray", false], sc: "T1" },
  { name: "Andre Peterson", city: 1, status: "SUSPENDED", availability: "OFFLINE", vehicle: ["Hyundai", "Elantra", 2020, "Black", false], sc: "SUSPENDED" },
  { name: "Hannah Cho", city: 1, status: "DRAFT", availability: "OFFLINE", vehicle: ["Mazda", "Mazda3", 2021, "Red", false], sc: null },
  { name: "Carlos Mendoza", city: 2, status: "APPROVED", availability: "OFFLINE", vehicle: ["Toyota", "Camry", 2022, "White", false], sc: "T3" },
  { name: "Lakeisha Monroe", city: 2, status: "REJECTED", availability: "OFFLINE", vehicle: ["Chevrolet", "Cruze", 2018, "Gray", false], sc: null },
  { name: "Pavel Novak", city: 2, status: "DEACTIVATED", availability: "OFFLINE", vehicle: ["Ford", "Focus", 2017, "Blue", false], sc: "REVOKED" },
];

const PLATE_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const randPlate = () => `${pick(r, [...PLATE_LETTERS])}${pick(r, [...PLATE_LETTERS])}${pick(r, [...PLATE_LETTERS])}-${randInt(r, 1000, 9999)}`;

const CITY_CENTERS: Array<[number, number]> = [
  [30.2672, -97.7431],
  [32.7767, -96.797],
  [29.7604, -95.3698],
];
const CITY_LABEL = ["Austin", "Dallas", "Houston"];
const STREETS = ["Burnet Rd", "E Riverside Dr", "Manor Rd", "S 1st St", "Guadalupe St", "Lamar Blvd", "Oltorf St", "Slaughter Ln", "Research Blvd", "Airport Blvd"];
const AREA_FOR_CITY = ["512", "214", "713"];

const DOC_TYPES_BASE = ["GOVERNMENT_ID", "DRIVERS_LICENSE", "VEHICLE_REGISTRATION", "VEHICLE_INSURANCE", "BACKGROUND_CHECK", "PROFILE_PHOTO"];
const PDF_TYPES = new Set(["VEHICLE_INSURANCE", "BACKGROUND_CHECK", "DRIVING_RECORD"]);

function docNumber(type: string): string {
  switch (type) {
    case "DRIVERS_LICENSE":
      return `TX ${randInt(r, 10_000_000, 99_999_999)}`;
    case "GOVERNMENT_ID":
      return `ID-${randInt(r, 100_000, 999_999)}${randInt(r, 10, 99)}`;
    case "VEHICLE_REGISTRATION":
      return `VR-${randInt(r, 1_000_000, 9_999_999)}`;
    case "VEHICLE_INSURANCE":
      return `POL-${randInt(r, 1_000_000, 9_999_999)}`;
    case "BACKGROUND_CHECK":
      return `BGC-${randInt(r, 100_000, 999_999)}`;
    default:
      return `DOC-${randInt(r, 100_000, 999_999)}`;
  }
}

interface DocSpec {
  status: ApiDocumentStatus;
  reason?: string;
  expiryDays?: number;
  version?: number;
  uploadedAgoMs?: number;
}

function makeDoc(
  captainId: string,
  vehicleId: string | null,
  type: string,
  spec: DocSpec,
  now: number,
  verifier: string,
  docNumbers: Record<string, string>,
): ApiStaffDocument {
  const meta = DOC_META[type];
  const id = uuid(r);
  const number = docNumber(type);
  docNumbers[id] = number;
  const uploadedAt = now - (spec.uploadedAgoMs ?? randInt(r, 3, 40) * DAY);
  const expiryMsValue = meta.expiry ? now + (spec.expiryDays ?? randInt(r, 150, 700)) * DAY : null;
  const verified = spec.status === "VERIFIED" || spec.status === "EXPIRED";
  const reviewed = verified || spec.status === "REJECTED" || spec.status === "RESUBMISSION_REQUESTED";
  return {
    id,
    captainId,
    vehicleId: meta.vehicle ? vehicleId : null,
    type,
    label: labelFor(type),
    title: labelFor(type),
    status: spec.status,
    documentNumber: ["PROFILE_PHOTO", "DEACTIVATION_EXPLANATION"].includes(type) ? null : maskNumber(number),
    issuedDate: expiryMsValue ? isoDate(expiryMsValue - (type === "DRIVERS_LICENSE" ? 4 : 1) * 365 * DAY) : null,
    expiryDate: expiryMsValue ? isoDate(expiryMsValue) : null,
    mimeType: PDF_TYPES.has(type) ? "application/pdf" : "image/svg+xml",
    sizeBytes: randInt(r, 180_000, 2_100_000),
    version: spec.version ?? 1,
    verifiedAt: verified ? iso(uploadedAt + 4 * HOUR) : null,
    verifiedBy: verified ? verifier : null,
    reviewedAt: reviewed ? iso(uploadedAt + 4 * HOUR) : null,
    reviewedBy: reviewed ? verifier : null,
    rejectionReason: spec.reason ?? null,
    uploadedAt: iso(uploadedAt),
    fileUrl: null,
    viewPath: `/admin/captains/${captainId}/documents/${id}/url`,
  };
}

function docSpecsFor(def: CaptainDef, index: number): Record<string, DocSpec> {
  const base: Record<string, DocSpec> = {};
  const all = [...DOC_TYPES_BASE, ...(def.sc ? ["DRIVING_RECORD", "DEACTIVATION_EXPLANATION"] : [])];
  for (const t of all) base[t] = { status: "VERIFIED" };
  const everyone = (status: ApiDocumentStatus, uploadedAgoMs: number) => {
    for (const t of all) base[t] = { status, uploadedAgoMs: uploadedAgoMs - randInt(r, 0, 90) * MIN };
  };
  switch (def.status) {
    case "SUBMITTED":
      everyone("PENDING", (index === 14 ? 30 : 7) * HOUR);
      break;
    case "UNDER_REVIEW":
      everyone("PENDING", 2 * DAY);
      for (const t of ["GOVERNMENT_ID", "DRIVERS_LICENSE", "PROFILE_PHOTO"]) base[t] = { status: "VERIFIED", uploadedAgoMs: 2 * DAY };
      break;
    case "DRAFT":
      base.DRIVERS_LICENSE = { status: "RESUBMISSION_REQUESTED", reason: "The license photo is blurry. Upload a clear photo of the front and back.", uploadedAgoMs: 3 * DAY };
      break;
    case "REJECTED":
      base.BACKGROUND_CHECK = { status: "REJECTED", reason: "Background check returned a disqualifying record.", uploadedAgoMs: 12 * DAY };
      break;
    case "DEACTIVATED":
      base.VEHICLE_INSURANCE = { status: "EXPIRED", expiryDays: -20 };
      break;
    default:
      break;
  }
  // Two approved captains carry an expiring document so the dashboard alert and the KYC renewal queue have content.
  if (index === 3) base.DRIVERS_LICENSE = { status: "VERIFIED", expiryDays: 9 };
  if (index === 9) base.VEHICLE_INSURANCE = { status: "VERIFIED", expiryDays: 12 };
  return base;
}

function scTierOf(kind: SecondChanceKind): ApiScTier {
  return kind === "T2" ? "TIER_2_RESTRICTED" : kind === "T3" ? "TIER_3_GRADUATED" : "TIER_1_PROBATION";
}

function scStatusOf(kind: SecondChanceKind): ApiScStatus {
  switch (kind) {
    case "APPLIED":
      return "APPLIED";
    case "REVIEW":
      return "UNDER_REVIEW";
    case "SUSPENDED":
      return "SUSPENDED";
    case "REVOKED":
      return "REVOKED";
    default:
      return "APPROVED";
  }
}

function buildSecondChance(c: ApiCaptainDetail, kind: Exclude<SecondChanceKind, null>, now: number): ApiScDetail {
  const status = scStatusOf(kind);
  const tier = scTierOf(kind);
  const approved = status === "APPROVED";
  const target = tier === "TIER_1_PROBATION" ? 50 : tier === "TIER_2_RESTRICTED" ? 60 : 100;
  const completed = approved ? (kind === "T1" ? 14 : kind === "T2" ? 38 : 100) : status === "SUSPENDED" ? 21 : 0;
  const appliedAt = now - (approved ? 120 : 6) * DAY;
  const notesBy = "Marcus Vance";
  return {
    captainId: c.id,
    captain: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      avatar: null,
      cityId: c.cityId,
      city: c.city,
      status: c.status,
      availability: c.availability,
      rating: c.metrics.rating,
      totalTrips: c.metrics.totalTrips,
    },
    status,
    isEnrolled: approved,
    tier,
    enrolledDate: iso(appliedAt + 5 * DAY),
    appliedAt: iso(appliedAt),
    sponsorMentor: approved || status === "SUSPENDED" ? pick(r, ["Marcus Vance", "Elena Rostova", "Devon Chen"]) : null,
    eligibilityNotes: approved ? "Deactivated by a former platform over a documented incident in 2023; completed a defensive-driving course." : null,
    speedGovernorEnabled: kind === "T1" || kind === "SUSPENDED",
    maxDailyHours: kind === "T1" ? 8 : kind === "T2" ? 10 : null,
    restrictedNightDriving: kind === "T1",
    restrictions:
      kind === "T1"
        ? { maxDailyHours: 8, maxTripDistanceMeters: 40_000, restrictedNightDriving: true, nightWindow: { start: "22:00", end: "05:00" } }
        : kind === "T2"
          ? { maxDailyHours: 10 }
          : {},
    probationRidesTarget: target,
    probationRidesCompleted: completed,
    incidentCount: kind === "SUSPENDED" ? 2 : kind === "T2" ? 1 : 0,
    complianceScore: approved ? (kind === "T3" ? 99 : kind === "T2" ? 94 : 97) : status === "SUSPENDED" ? 71 : 0,
    lastAuditDate: approved ? isoDate(now - 30 * DAY) : null,
    nextReviewAt: approved ? iso(now + (kind === "T3" ? -3 : kind === "T2" ? 18 : 41) * DAY) : null,
    reviewDue: approved && kind === "T3",
    expiresAt: approved ? iso(now + 240 * DAY) : null,
    reviewedAt: approved || status === "SUSPENDED" ? iso(appliedAt + 5 * DAY) : null,
    reviewedBy: approved || status === "SUSPENDED" ? notesBy : null,
    revokedAt: kind === "REVOKED" ? iso(now - 40 * DAY) : null,
    previousPlatforms: [{ name: pick(r, ["Uber", "Lyft", "Via"]), deactivatedAt: isoDate(now - 700 * DAY), reasonCategory: "SAFETY_COMPLAINT" }],
    deactivationExplanation: "I was deactivated after a rider complaint about a disputed route. I have since completed a defensive-driving course and a new background check.",
    decisionReason: kind === "REVOKED" ? "Repeated policy violations during probation" : kind === "SUSPENDED" ? "Two safety incidents within 30 days" : approved ? "Meets all Second Chance eligibility criteria" : null,
    requiredDocuments: c.documentChecklist
      .filter((d) => ["DRIVING_RECORD", "DEACTIVATION_EXPLANATION", "BACKGROUND_CHECK"].includes(d.documentType))
      .map((d) => ({ documentType: d.documentType, label: d.label, state: d.state, ok: d.ok, documentId: d.documentId, rejectionReason: d.rejectionReason })),
    recentNotes: [
      {
        id: uuid(r),
        authorId: null,
        authorName: notesBy,
        body: approved ? "Weekly check-in: on track, no complaints. Governor stays on until ride 30." : "Application received, waiting for the background check.",
        isInternal: true,
        createdAt: iso(now - 2 * DAY),
      },
    ],
  };
}

function seedCaptains(now: number, cityIds: string[], staffNames: string[]): CaptainRow[] {
  const verifier = staffNames.includes("Marcus Vance") ? "Marcus Vance" : (staffNames[0] ?? "Staff");
  return CAPTAIN_DEFS.map((def, index) => {
    const id = uuid(r);
    const cityId = cityIds[def.city];
    const [first, ...rest] = def.name.split(" ");
    const last = rest.join(" ");
    const vehicleId = uuid(r);
    const [make, model, year, color, isElectric] = def.vehicle;
    const approved = def.status === "APPROVED" || def.status === "SUSPENDED" || def.status === "DEACTIVATED";
    const joinedAgo = (approved ? randInt(r, 40, 420) : randInt(r, 2, 6)) * DAY;
    const submittedAt = def.status === "SUBMITTED" ? now - (index === 14 ? 30 : 7) * HOUR : def.status === "UNDER_REVIEW" ? now - 2 * DAY : now - joinedAgo + DAY;
    const vehicle: ApiVehicle = {
      id: vehicleId,
      make,
      model,
      year,
      color,
      plateNumber: randPlate(),
      plateState: "TX",
      isElectric,
      seats: 4,
      isWheelchairAccessible: false,
      status: approved ? "ACTIVE" : "PENDING_REVIEW",
      isPrimary: true,
    };
    const docNumbers: Record<string, string> = {};
    const specs = docSpecsFor(def, index);
    const docs: ApiStaffDocument[] = Object.entries(specs).map(([type, spec]) => makeDoc(id, vehicleId, type, spec, now, verifier, docNumbers));
    // Renewal uploads waiting for review on two approved captains.
    if (index === 4 || index === 10) {
      docs.push(makeDoc(id, vehicleId, "VEHICLE_INSURANCE", { status: "PENDING", version: 2, uploadedAgoMs: 6 * HOUR, expiryDays: 365 }, now, verifier, docNumbers));
    }
    docs.sort((a, b) => (a.type === b.type ? b.version - a.version : a.type.localeCompare(b.type)));

    const trips = approved ? randInt(r, 90, 3400) : 0;
    const area = AREA_FOR_CITY[def.city];
    const email = `${first}.${last.replace(/[^A-Za-z]/g, "")}@${pick(r, MAIL)}`.toLowerCase();
    const statusHistory: ApiCaptainDetail["statusHistory"] = [
      { id: uuid(r), from: null, to: "DRAFT", reason: null, at: iso(now - joinedAgo) },
    ];
    if (def.status !== "DRAFT") statusHistory.push({ id: uuid(r), from: "DRAFT", to: "SUBMITTED", reason: null, at: iso(submittedAt) });
    if (def.status === "UNDER_REVIEW") statusHistory.push({ id: uuid(r), from: "SUBMITTED", to: "UNDER_REVIEW", reason: "Review started", at: iso(now - 20 * HOUR) });
    if (def.status === "APPROVED" || def.status === "SUSPENDED" || def.status === "DEACTIVATED") statusHistory.push({ id: uuid(r), from: "SUBMITTED", to: "APPROVED", reason: "All documents verified", at: iso(submittedAt + 2 * DAY) });
    if (def.status === "SUSPENDED") statusHistory.push({ id: uuid(r), from: "APPROVED", to: "SUSPENDED", reason: "Two safety incidents within 30 days", at: iso(now - 6 * DAY) });
    if (def.status === "DEACTIVATED") statusHistory.push({ id: uuid(r), from: "APPROVED", to: "DEACTIVATED", reason: "Insurance lapsed and not renewed", at: iso(now - 15 * DAY) });
    if (def.status === "REJECTED") statusHistory.push({ id: uuid(r), from: "SUBMITTED", to: "REJECTED", reason: "Background check returned a disqualifying record", at: iso(now - 12 * DAY) });
    if (def.status === "DRAFT") statusHistory.push({ id: uuid(r), from: "SUBMITTED", to: "DRAFT", reason: "Resubmission requested: driver's license photo unreadable", at: iso(now - 3 * DAY) });

    const serviceTypes: ApiCaptainDetail["serviceTypes"] = def.prime
      ? [
          { code: "AMOOR_PRIME", name: "AMOOR Prime", vehicleId, enabled: true },
          { code: "AMOOR_SEDAN", name: "AMOOR Sedan", vehicleId, enabled: true },
        ]
      : isElectric
        ? [
            { code: "AMOOR_EV", name: "AMOOR EV", vehicleId, enabled: true },
            { code: "AMOOR_GO", name: "AMOOR Go", vehicleId, enabled: true },
          ]
        : [
            { code: "AMOOR_GO", name: "AMOOR Go", vehicleId, enabled: true },
            { code: "AMOOR_SEDAN", name: "AMOOR Sedan", vehicleId, enabled: year >= 2021 },
          ];

    const detail: ApiCaptainDetail = {
      id,
      name: def.name,
      firstName: first,
      lastName: last,
      phone: maskedPhone(area, String(randInt(r, 1000, 9999))),
      email,
      avatar: null,
      dateOfBirth: `${randInt(r, 1966, 2000)}-${String(randInt(r, 1, 12)).padStart(2, "0")}-${String(randInt(r, 1, 28)).padStart(2, "0")}`,
      address: { addressLine: `${randInt(r, 100, 9800)} ${pick(r, STREETS)}`, city: CITY_LABEL[def.city], state: "TX", postalCode: String(randInt(r, 73301, 78799)) },
      cityId,
      city: CITY_LABEL[def.city],
      status: def.status,
      statusReason: statusHistory[statusHistory.length - 1]?.reason ?? null,
      availability: def.availability,
      onRide: def.availability === "ON_RIDE",
      activeRideId: null,
      isSecondChance: def.sc !== null,
      secondChance: null,
      flagged: index === 9 || index === 20,
      payoutsEnabled: def.status === "APPROVED",
      submittedAt: iso(submittedAt),
      approvedAt: approved ? iso(submittedAt + 2 * DAY) : null,
      approvedBy: approved ? verifier : null,
      reapplyAfter: def.status === "REJECTED" ? iso(now + 18 * DAY) : null,
      suspendedUntil: def.status === "SUSPENDED" ? iso(now + 24 * DAY) : null,
      joinedAt: iso(now - joinedAgo),
      lastOnlineAt: def.availability === "OFFLINE" ? iso(now - randInt(r, 2, 40) * HOUR) : iso(now - randInt(r, 0, 5) * MIN),
      metrics: {
        rating: approved ? Math.round(randFloat(r, 4.62, 4.99) * 100) / 100 : 0,
        ratingCount: Math.round(trips * 0.62),
        totalTrips: trips,
        acceptanceRate: approved ? Math.round(randFloat(r, 0.82, 0.97) * 1000) / 1000 : 0,
        cancellationRate: approved ? Math.round(randFloat(r, 0.008, 0.06) * 1000) / 1000 : 0,
        offersReceived: trips * 2,
        offersAccepted: Math.round(trips * 1.78),
        offersDeclined: Math.round(trips * 0.14),
        offersMissed: Math.round(trips * 0.08),
        ridesCancelled: Math.round(trips * 0.03),
      },
      vehicle: { make, model, year, color, plateNumber: vehicle.plateNumber, plateState: "TX", isElectric, status: vehicle.status },
      vehicles: [vehicle],
      serviceTypes,
      documents: docs,
      documentChecklist: [],
      eligibility: { eligible: false, reasons: [] },
      statusHistory,
    };
    refreshDerived(detail, now);

    const [clat, clng] = CITY_CENTERS[def.city];
    const row: CaptainRow = {
      d: detail,
      docNumbers,
      lat: clat + randFloat(r, -0.045, 0.045),
      lng: clng + randFloat(r, -0.045, 0.045),
      sc: null,
    };
    if (def.sc) {
      row.sc = buildSecondChance(detail, def.sc, now);
      detail.secondChance = { status: row.sc.status, tier: row.sc.tier, expiresAt: row.sc.expiresAt, nextReviewAt: row.sc.nextReviewAt };
    }
    return row;
  });
}

export function seedPeople(now: number, cityIds: string[]): PeopleSeed {
  const roleIds = new Map<string, string>();
  const roles: ApiRole[] = SYSTEM_ROLES.map((role) => {
    const id = uuid(r);
    roleIds.set(role.key, id);
    return {
      id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: true,
      permissions: [...role.permissions],
      userCount: 0,
      createdAt: iso(now - 90 * DAY),
      updatedAt: iso(now - 90 * DAY),
    };
  });
  const customId = uuid(r);
  roles.push({
    id: customId,
    key: "REGIONAL_SUPPORT_LEAD",
    name: "Regional Support Lead",
    description: "Support agents who can also approve small refunds and moderate ratings",
    isSystem: false,
    permissions: ["dashboard.view", "users.view", "captains.view", "rides.view", "support.manage", "finance.view", "finance.refund", "safety.manage", "ratings.moderate"],
    userCount: 0,
    createdAt: iso(now - 30 * DAY),
    updatedAt: iso(now - 12 * DAY),
  });

  const meStaff: ApiStaff = {
    id: DEMO_STAFF_ID,
    name: "Demo Admin",
    email: "demo.admin@amoorgo.com",
    status: "ACTIVE",
    avatarUrl: null,
    cityScope: [],
    expiresAt: null,
    totpEnabled: true,
    lastLoginAt: iso(now),
    createdAt: iso(now - 200 * DAY),
    roles: [{ id: roleIds.get("SUPER_ADMIN") as string, key: "SUPER_ADMIN", name: "Super Admin", isSystem: true }],
    overrides: [],
  };
  const staff: ApiStaff[] = [meStaff];
  for (const def of STAFF_DEFS) {
    const role = roles.find((x) => x.key === def.role);
    staff.push({
      id: uuid(r),
      name: def.name,
      email: def.email,
      status: def.status,
      avatarUrl: null,
      cityScope: def.scope.map((k) => cityIds[k === "austin" ? 0 : k === "dallas" ? 1 : 2]),
      expiresAt: def.status === "INVITED" ? iso(now + 5 * DAY) : null,
      totpEnabled: def.totp,
      lastLoginAt: def.lastLoginMin === null ? null : iso(now - def.lastLoginMin * MIN),
      createdAt: iso(now - randInt(r, 30, 180) * DAY),
      roles: role ? [{ id: role.id, key: role.key, name: role.name, isSystem: role.isSystem }] : [],
      overrides: def.name === "Devon Chen" ? [{ permission: "finance.refund", effect: "DENY" }] : [],
      inviteEmailSent: def.status === "INVITED" ? true : undefined,
    });
  }
  for (const m of staff) for (const role of m.roles) {
    const row = roles.find((x) => x.id === role.id);
    if (row) row.userCount += 1;
  }
  // The custom role has one holder so the matrix shows a non-empty custom column.
  const tomas = staff.find((m) => m.name === "Tomas Becker");
  const custom = roles.find((x) => x.id === customId);
  if (tomas && custom) {
    tomas.roles = [{ id: custom.id, key: custom.key, name: custom.name, isSystem: false }];
    custom.userCount = 1;
    const support = roles.find((x) => x.key === "SUPPORT_AGENT");
    if (support) support.userCount = Math.max(0, support.userCount - 1);
  }

  const me: StaffMe = {
    id: DEMO_STAFF_ID,
    name: meStaff.name,
    email: meStaff.email,
    avatarUrl: null,
    roles: ["SUPER_ADMIN"],
    permissions: [...ALL_PERMISSIONS],
    cityScope: [],
    totpEnabled: true,
    mustEnrolTotp: false,
    lastLoginAt: iso(now),
    sessionId: uuid(r),
  };

  const riders = seedRiders(now);
  const captains = seedCaptains(now, cityIds, staff.map((m) => m.name));
  return { me, staff, roles, permissionCatalogue: permissionCatalogue(), riders, captains };
}
