// services/userService.ts
import type {
  UserProfile,
  ProfileCreatePayload,
  ProfileUpdatePayload,
  SubscriptionResponse,
  NotificationPreferences,
  NotificationPreferencesUpdatePayload,
} from "../models/User";
import { apiFetch } from "./apiClient";

export const userService = {
  async getUserProfile(): Promise<UserProfile> {
    return apiFetch<UserProfile>('/v1/users/profile');
  },

  // POST /v1/users/register — creates the user with basic info + role only
  async createUserProfile(payload: ProfileCreatePayload): Promise<UserProfile> {
    return apiFetch<UserProfile>('/v1/users/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // PATCH /v1/users/profile — sets investor financial data after profile creation
  async updateUserProfile(payload: ProfileUpdatePayload): Promise<void> {
    return apiFetch<void>('/v1/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getSubscription(): Promise<SubscriptionResponse> {
    return apiFetch<SubscriptionResponse>('/v1/users/subscription');
  },

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return apiFetch<NotificationPreferences>('/v1/users/notification-preferences');
  },

  async updateNotificationPreferences(payload: NotificationPreferencesUpdatePayload): Promise<NotificationPreferences> {
    return apiFetch<NotificationPreferences>('/v1/users/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // DELETE /v1/users/account — permanently deletes the account and all associated data
  async deleteAccount(): Promise<void> {
    return apiFetch<void>('/v1/users/account', { method: 'DELETE' });
  },
};
