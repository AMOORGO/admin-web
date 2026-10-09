/** Staff profile as returned by POST /admin/auth/login (AUTHENTICATED) and GET /admin/me. */
export interface StaffMe {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Role keys, e.g. ["SUPER_ADMIN"] */
  roles: string[];
  /** Effective permission keys (roles + overrides), e.g. "finance.refund" */
  permissions: string[];
  /** City ids the person may operate in; empty = all cities */
  cityScope: string[];
  totpEnabled: boolean;
  mustEnrolTotp: boolean;
  lastLoginAt: string | null;
  sessionId?: string;
}

export interface AuthenticatedLogin {
  status: "AUTHENTICATED";
  accessToken: string;
  refreshToken: string;
  /** seconds */
  expiresIn: number;
  sessionId: string;
  user: StaffMe;
}

export interface TwoFactorChallenge {
  status: "TWO_FACTOR_REQUIRED";
  challengeToken: string;
  expiresIn: number;
  /** true: the account must enrol an authenticator app first (secret from /admin/auth/2fa/enrol) */
  enrolmentRequired: boolean;
}

export type LoginResult = AuthenticatedLogin | TwoFactorChallenge;

export interface EnrolmentInfo {
  secret: string;
  otpauthUrl: string;
}
