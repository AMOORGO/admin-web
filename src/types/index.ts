export type StaffRole =
  | "SUPER_ADMIN"
  | "OPERATIONS_ADMIN"
  | "CAPTAIN_OPS"
  | "FINANCE_ADMIN"
  | "SUPPORT_AGENT"
  | "READ_ONLY";

export type PermissionKey =
  | "dashboard.view"
  | "rides.view"
  | "rides.reassign"
  | "rides.cancel"
  | "rides.adjust_fare"
  | "users.view"
  | "users.suspend"
  | "captains.view"
  | "captains.approve"
  | "captains.review_docs"
  | "captains.suspend"
  | "second_chance.manage"
  | "finance.view"
  | "finance.refund"
  | "finance.payouts"
  | "safety.manage"
  | "support.manage"
  | "config.view"
  | "config.edit"
  | "staff.create"
  | "staff.manage"
  | "roles.manage"
  | "audit.view"
  | "reports.export";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  avatar: string;
  cityScope: string[]; // ['ALL'] or ['Austin', 'Dallas']
  is2FAEnabled: boolean;
  lastLogin: string;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  customOverrides?: Record<PermissionKey, "ALLOW" | "DENY">;
}

export type RideStatus =
  | "SEARCHING"
  | "ACCEPTED"
  | "ARRIVING"
  | "ARRIVED"
  | "ON_TRIP"
  | "COMPLETED"
  | "CANCELLED";

export type ServiceType =
  | "AMOOR_GO"
  | "AMOOR_PRIME"
  | "AMOOR_SEDAN"
  | "AMOOR_MOTO"
  | "AMOOR_AUTO"
  | "AMOOR_EV";

export interface RideTimelineStep {
  status: string;
  title: string;
  timestamp: string;
  latencySeconds?: number;
  description: string;
}

export interface DispatchCandidate {
  captainId: string;
  captainName: string;
  rating: number;
  distanceMiles?: number;
  distanceKm?: number;
  offeredAt: string;
  response: "ACCEPTED" | "DECLINED" | "TIMEOUT";
  reason?: string;
}

export interface FareBreakdown {
  baseFare: number;
  distanceMiles?: number;
  distanceKm?: number;
  distanceFare: number;
  durationMinutes: number;
  timeFare: number;
  surgeMultiplier: number;
  surgeFare: number;
  tollAndWait: number;
  taxes: number;
  grossFare: number;
  platformCommission: number; // e.g. 15%
  captainNetPayout: number;
}

export interface Ride {
  id: string;
  bookingCode: string; // e.g. #AG-8942
  city: string;
  serviceType: ServiceType;
  status: RideStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  rider: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    avatar: string;
  };
  captain?: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    avatar: string;
    vehiclePlate: string;
    vehicleModel: string;
    vehicleColor: string;
  };
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: [number, number]; // [lat, lng]
  dropoffCoords: [number, number];
  currentCoords?: [number, number];
  otpPin: string;
  fare: FareBreakdown;
  paymentMethod: "STRIPE_CARD" | "RAZORPAY" | "AMOOR_WALLET" | "CASH";
  paymentStatus: "PENDING" | "CAPTURED" | "REFUNDED" | "FAILED";
  timeline: RideTimelineStep[];
  dispatchAttempts: DispatchCandidate[];
  hasSOSAlert?: boolean;
}

export type CaptainStatus =
  | "ACTIVE"
  | "PENDING_REVIEW"
  | "SUSPENDED"
  | "OFFLINE"
  | "ON_TRIP";

export interface CaptainDocument {
  id: string;
  type: "DRIVING_LICENSE" | "VEHICLE_RC" | "COMMERCIAL_INSURANCE" | "BACKGROUND_CHECK" | "PROFILE_PHOTO";
  title: string;
  documentNumber: string;
  issuedDate: string;
  expiryDate: string;
  fileUrl: string;
  status: "VERIFIED" | "PENDING" | "REJECTED" | "RESUBMISSION_REQUESTED";
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
}

export interface SecondChanceProfile {
  isEnrolled: boolean;
  tier: "TIER_1_PROBATION" | "TIER_2_RESTRICTED" | "TIER_3_GRADUATED";
  enrolledDate: string;
  sponsorMentor: string;
  eligibilityNotes: string;
  speedGovernorEnabled: boolean;
  maxDailyHours: number;
  restrictedNightDriving: boolean;
  probationRidesTarget: number;
  probationRidesCompleted: number;
  incidentCount: number;
  complianceScore: number; // percentage, e.g. 98%
  lastAuditDate: string;
}

export interface Captain {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  avatar: string;
  serviceTypes: ServiceType[];
  status: CaptainStatus;
  currentCoords?: [number, number];
  rating: number;
  totalTrips: number;
  acceptanceRate: number; // e.g. 94%
  cancellationRate: number; // e.g. 2.1%
  todayEarnings: number;
  lifetimeEarnings: number;
  unsettledBalance: number;
  joinedAt: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    plateNumber: string;
    isElectric: boolean;
  };
  documents: CaptainDocument[];
  secondChance: SecondChanceProfile;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  avatar: string;
  rating: number;
  totalRides: number;
  lifetimeSpend: number;
  walletBalance: number;
  status: "ACTIVE" | "SUSPENDED" | "FLAGGED";
  joinedAt: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  savedPlaces: { name: string; address: string }[];
}

export interface SOSIncident {
  id: string;
  rideId: string;
  triggeredBy: "RIDER" | "CAPTAIN";
  userName: string;
  userPhone: string;
  city: string;
  timestamp: string;
  slaSecondsLeft: number; // count down from 60s
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "FALSE_ALARM";
  coords: [number, number];
  batteryLevel: number;
  speedMph?: number;
  speedKmh?: number;
  audioRecordingAvailable: boolean;
  responderNotes: string[];
  assignedStaff?: string;
  resolvedAt?: string;
}

export interface Transaction {
  id: string;
  rideId: string;
  idempotencyKey: string;
  amount: number;
  platformFee: number;
  captainEarnings: number;
  gateway: "STRIPE" | "RAZORPAY" | "CASH" | "WALLET";
  type: "RIDE_FARE" | "TIP" | "CANCELLATION_FEE" | "REFUND" | "PAYOUT";
  status: "SUCCESS" | "PENDING" | "FAILED" | "DISPUTED";
  timestamp: string;
  customerName: string;
  captainName: string;
}

export interface PayoutBatch {
  id: string;
  batchNumber: string;
  city: string;
  totalCaptains: number;
  totalGrossPayable: number;
  commissionOffset: number;
  netPayoutAmount: number;
  status: "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED";
  generatedAt: string;
  settledAt?: string;
}

export interface RefundRequest {
  id: string;
  rideId: string;
  riderName: string;
  riderPhone: string;
  amount: number;
  reason: string;
  category: "OVERCHARGED" | "DRIVER_MISBEHAVIOR" | "ROUTE_DEVIATION" | "VEHICLE_ISSUE" | "ACCIDENTAL_CHARGE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: {
    name: string;
    email: string;
    role: StaffRole;
  };
  action: string;
  category: "RIDE" | "CAPTAIN" | "FINANCE" | "SAFETY" | "STAFF" | "CONFIG";
  targetId: string;
  targetType: string;
  ipAddress: string;
  reasonNotes?: string;
  diff?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
}

export interface CityPricingConfig {
  city: string;
  currency: string;
  baseFare: number;
  perMileRate?: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  cancellationFee: number;
  nightSurchargeMultiplier: number;
  airportTollFee: number;
  platformCommissionPercent: number;
  surgeCapMultiplier: number;
  isSurgeAutomated: boolean;
}

export interface GeofenceZone {
  id: string;
  city: string;
  name: string;
  type: "STANDARD" | "HIGH_DEMAND" | "RESTRICTED" | "AIRPORT";
  surgeFactor: number;
  activeCaptainsCount: number;
  activeRidesCount: number;
}
