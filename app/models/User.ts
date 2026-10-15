// models/User.ts
// Aligned with backend DTOs in app/api/dto/routes_user.py

// Matches UserRoles enum from backend
type UserRole = 'USER' | 'ADVISOR';

// Matches SubscriptionTier enum from backend
// DEMO: a read-only demo account (see lib/demo).
type SubscriptionTier = 'FREE' | 'TESTER' | 'DEMO';

// Matches FinancialKnowledgeLevel enum from backend
type FinancialKnowledgeLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

// Matches UserProfileResponse DTO (GET /users/profile, POST /users/profile response)
interface UserProfile {
  uuid: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string | null;
  language: string;
  profile_picture: string | null;
  first_name: string | null;
  last_name: string | null;
  // Investor profile fields (null until set via PATCH /users/profile)
  estimated_wealth: number | null;
  annual_income: number | null;
  savings_rate: number | null;
  financial_goals: string[] | null;
  risk_tolerance: string | null;
  financial_knowledge_level: FinancialKnowledgeLevel | null;
  currency: string | null;
  subscription_tier: SubscriptionTier | null;
}

// Matches ProfileCreatePayload DTO (POST /users/profile)
interface ProfileCreatePayload {
  first_name: string;
  last_name: string;
  language: string;
  role: UserRole;
}

// Matches ProfileUpdatePayload DTO (PATCH /users/profile) — investor financial data,
// plus basic identity fields (first_name/last_name)
interface ProfileUpdatePayload {
  first_name?: string | null;
  last_name?: string | null;
  estimated_wealth?: number | null;
  annual_income?: number | null;
  savings_rate?: number | null;
  financial_goals?: string[] | null;
  risk_tolerance?: string | null;
  financial_knowledge_level?: FinancialKnowledgeLevel | null;
  currency?: string | null;
  language?: string | null;
}

// Matches SubscriptionResponse DTO (GET /users/subscription, POST /users/subscription) —
// monthly_reports_limit and has_unlimited_reports are also on the DTO but unused on the
// frontend now that report quotas are no longer surfaced in the UI.
interface SubscriptionResponse {
  tier: SubscriptionTier;
  plan_name: string;
  created_at: string;
  updated_at: string;
}

// Matches NotificationPreferencesResponse DTO (GET /users/notification-preferences)
interface NotificationPreferences {
  report_status_email: boolean;
  marketing_email: boolean;
  product_updates_email: boolean;
  in_app_notifications: boolean;
  updated_at: string | null;
}

// Matches NotificationPreferencesUpdatePayload DTO (PATCH /users/notification-preferences)
interface NotificationPreferencesUpdatePayload {
  report_status_email?: boolean | null;
  marketing_email?: boolean | null;
  product_updates_email?: boolean | null;
  in_app_notifications?: boolean | null;
}

export type {
  UserProfile,
  ProfileCreatePayload,
  ProfileUpdatePayload,
  UserRole,
  SubscriptionTier,
  FinancialKnowledgeLevel,
  SubscriptionResponse,
  NotificationPreferences,
  NotificationPreferencesUpdatePayload,
};
