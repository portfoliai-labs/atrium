"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// No homepage here: the public site lives in its own repo (vestibulum). The root sends a signed-in
// visitor to the dashboard and anyone else to the login, without the `?next=` the dashboard's
// guard would add.
export default function Root() {
  const router = useRouter();

  useEffect(() => {
    let signedIn = false;
    try {
      signedIn = !!localStorage.getItem("auth_token");
    } catch {
      // Storage blocked: treat as signed out.
    }
    router.replace(signedIn ? "/dashboard" : "/login");
  }, [router]);

  return null;
}
