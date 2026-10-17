// models/AdvisorRequest.ts
// Advisor matching and requests (ianus: /users/advisor-matches, /users/advisor-requests,
// /advisor/requests). The platform suggests advisors to an investor, with the reasons; the
// investor asks one of them, sharing their investor policy; the advisor accepts or declines.
import type { IpsAdvisoryTopic, IpsFeeModel, IpsMeetingMode } from "./InvestorPolicy";

type AdvisorRequestStatus = "pending" | "accepted" | "declined" | "withdrawn" | "expired";

// An advisor's public profile: shown only within the investor's matches and requests.
interface AdvisorCard {
  advisorUuid: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  bio: string;
  languages: string[];
  meetingModes: IpsMeetingMode[];
  city: string;
  feeModels: IpsFeeModel[];
  topics: IpsAdvisoryTopic[];
  // In EUR; null: any.
  minClientWealth: number | null;
  // Their number on the OCF register, verified by the platform's staff.
  registerNumber: string;
  yearsExperience: number | null;
  specialization: string | null;
}

// What the advisor and the investor share.
interface MatchReasons {
  languages: string[];
  // In person only when in the investor's city.
  meetingModes: IpsMeetingMode[];
  sameCity: boolean;
  // Empty when the investor named no fee model.
  feeModels: IpsFeeModel[];
  topics: IpsAdvisoryTopic[];
}

interface AdvisorMatch {
  advisor: AdvisorCard;
  reasons: MatchReasons;
}

interface AdvisorRequestPayload {
  advisorUuid: string;
  message: string;
  // The consent to share the investor policy with the advisor: required.
  shareInvestorPolicy: boolean;
}

interface RequestInvestor {
  userUuid: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
}

interface AdvisorRequest {
  requestUuid: string;
  // Null for a status this client doesn't know yet.
  status: AdvisorRequestStatus | null;
  message: string;
  // The advisor's words when they declined.
  reply: string;
  // The version of the investor policy shared with the advisor.
  investorPolicyVersion: number;
  createdAt: string;
  // When it expires if still pending.
  expiresAt: string;
  closedAt: string | null;
  advisor: AdvisorCard;
  investor: RequestInvestor;
}

export type {
  AdvisorRequestStatus,
  AdvisorCard,
  MatchReasons,
  AdvisorMatch,
  AdvisorRequestPayload,
  RequestInvestor,
  AdvisorRequest,
};
