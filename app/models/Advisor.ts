// models/Advisor.ts
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
  // ISO 3166-1 alpha-2; null until given (see models/Tax).
  tax_residence?: string | null;
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
  tax_residence?: string | null;
}

// Matches ClientLookupResponse DTO (GET /advisor/clients/lookup)
interface ClientLookupResponse {
  exists: boolean;
  first_name: string | null;
  last_name: string | null;
  role: UserRole | null;
}

export { UserRole };
export type {
  AdvisorProfile,
  AdvisorProfileUpdatePayload,
  Client,
  ClientCreatePayload,
  ClientProfileUpdatePayload,
  ClientLookupResponse,
};
