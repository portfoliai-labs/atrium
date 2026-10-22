// components/dashboard/UserAvatar.tsx
"use client";

import Image from "next/image";
import type { UserProfile } from "../../models/User";

/**
 * USER AVATAR — the user's picture (the top bar's, the Dashboard's profile), or without one their
 * initials on the dark tile. The picture goes through next/image without a referrer: Google's
 * (lh3.googleusercontent.com) refuses one sent with it. `className` sizes and rounds the tile;
 * `sizes` is the picture's rendered width.
 */
export function UserAvatar({ user, className, sizes, textClassName = "text-xs" }: {
  user: Pick<UserProfile, "first_name" | "last_name" | "profile_picture"> | null | undefined;
  className: string;
  sizes: string;
  textClassName?: string;
}) {
  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? "U"}`.toUpperCase();
  return (
    <div className={`relative bg-[#1c1917] flex items-center justify-center text-white shadow-inner overflow-hidden shrink-0 ${className}`}>
      {user?.profile_picture ? (
        <Image src={user.profile_picture} alt="Profile" fill sizes={sizes} className="object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className={`font-bold ${textClassName}`}>{initials}</span>
      )}
    </div>
  );
}
