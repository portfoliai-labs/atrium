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

// Matches ClientResponse DTO (GET /advisor/clients, POST /advisor/clients response)
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
}

// Matches ClientCreatePayload DTO (POST /advisor/clients)
interface ClientCreatePayload {
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  estimated_wealth?: number;
  annual_income?: number;
  financial_goals?: string;
  risk_tolerance?: string;
  currency?: string;
}

// Matches ClientProfileUpdatePayload DTO (PATCH /advisor/clients/{uuid}/profile)
interface ClientProfileUpdatePayload {
  estimated_wealth?: number | null;
  annual_income?: number | null;
  financial_goals?: string | null;
  risk_tolerance?: string | null;
  currency?: string | null;
  language?: string | null;
}

// Matches ClientLookupResponse DTO (GET /advisor/clients/lookup)
interface ClientLookupResponse {
  exists: boolean;
  first_name: string | null;
  last_name: string | null;
  role: UserRole | null;
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
  ClientCreatePayload,
  ClientProfileUpdatePayload,
  ClientLookupResponse,
  AdvisorStatementPayload,
  AdvisorStatement,
};
