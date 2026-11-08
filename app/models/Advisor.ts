// models/Advisor.ts
import type { IpsAdvisoryTopic, IpsFeeModel, IpsMeetingMode } from "./InvestorPolicy";
// Aligned with backend DTOs in app/api/dto/routes_advisor.py

// Matches UserRoles enum from backend (app/domain/models/core/user.py)
enum UserRole {
  USER = "USER",
  ADVISOR = "ADVISOR",
}

// Matches AdvisorProfileResponse DTO (GET /advisor/profile)
interface AdvisorProfile {
  years_experience: number | null;
  specialization: string | null;
  clients_count: number | null;
  aum: number | null;
  company_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
}

// Matches AdvisorProfileUpdatePayload DTO (PATCH /advisor/profile)
interface AdvisorProfileUpdatePayload {
  years_experience?: number | null;
  specialization?: string | null;
  clients_count?: number | null;
  aum?: number | null;
  company_name?: string | null;
  brand_color?: string | null;
}

// Matches ClientResponse DTO (GET /advisor/clients)
interface Client {
  uuid: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string | null;
  language: string;
  profile_picture: string | null;
  first_name: string | null;
  last_name: string | null;
  estimated_wealth: number | null;
  annual_income: number | null;
  financial_goals: string | null;
  risk_tolerance: string | null;
  currency: string | null;
  // ISO 3166-1 alpha-2; null until given (see models/Tax).
  tax_residence?: string | null;
}

// The advisor's statement (GET/PUT /advisor/statement): what they offer, in the words of the
// investor policy's advisor preferences, and their OCF register number. An empty list matches
// nothing: an advisor says what they do.
interface AdvisorStatementPayload {
  languages: string[];
  meetingModes: IpsMeetingMode[];
  city: string;
  feeModels: IpsFeeModel[];
  topics: IpsAdvisoryTopic[];
  // The smallest wealth of a client they take on, in EUR; null: any.
  minClientWealth: number | null;
  // Only an advisor taking on new clients is suggested to investors.
  acceptingClients: boolean;
  bio: string;
  registerNumber: string;
}

interface AdvisorStatement extends AdvisorStatementPayload {
  updatedAt: string;
  // Null until the platform's staff verify the register number; another number resets it.
  verifiedAt: string | null;
}

export { UserRole };
export type {
  AdvisorProfile,
  AdvisorProfileUpdatePayload,
  Client,
  AdvisorStatementPayload,
  AdvisorStatement,
};
