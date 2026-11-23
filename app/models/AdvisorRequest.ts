// models/AdvisorRequest.ts
// Advisor matching and requests (ianus: /users/advisor-matches, /users/advisor-requests,
// /advisor/requests). The platform suggests advisors to an investor, with the reasons; the
// investor asks one of them, sharing their investor policy; the advisor accepts or declines.
import type { AdvisorHorizon, AdvisorRiskProfile } from "./Advisor";
import type {
  AssetClassId, IpsAdvisoryTopic, IpsFeeModel, IpsInstrument, IpsMeetingMode, IpsPurpose, IpsReviewFrequency,
} from "./InvestorPolicy";

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
  // What they manage (see AdvisorStatementPayload).
  assetClasses: AssetClassId[];
  instruments: IpsInstrument[];
  leverage: boolean;
  purposes: IpsPurpose[];
  riskProfiles: AdvisorRiskProfile[];
  horizons: AdvisorHorizon[];
  reviewFrequency: IpsReviewFrequency | null;
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
  // The investor's purpose, when the advisor serves it.
  purpose: IpsPurpose | null;
  // The advisor's profile closest to the investor's; riskExact: the very same one.
  riskProfile: AdvisorRiskProfile | null;
  riskExact: boolean;
  // The investor's horizon, when the advisor works with it.
  horizon: AdvisorHorizon | null;
  // The investor's allocated classes and allowed instruments the advisor handles.
  assetClasses: AssetClassId[];
  instruments: IpsInstrument[];
  // The investor allows leverage and the advisor advises on it.
  leverage: boolean;
  // The advisor's review frequency, when at least as frequent as the investor asks.
  reviewFrequency: IpsReviewFrequency | null;
  // The points the reasons add up to: only the order of the suggestions.
  score: number;
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
