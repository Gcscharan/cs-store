export type AuthStateMachine = "ACTIVE" | "GOOGLE_AUTH_ONLY" | null;

export type UserRole = "customer" | "admin" | "delivery" | null;

export interface AuthRedirectInput {
  authState: AuthStateMachine;
  pathname: string;
  role: UserRole;
  isProtected?: boolean;
  allowedRoles?: ("customer" | "admin" | "delivery")[];
}

export function authRedirect(input: AuthRedirectInput): string | null {
  const {
    authState,
    pathname,
    role,
    isProtected = true,
    allowedRoles,
  } = input;

  const isOnboarding =
    pathname.startsWith("/onboarding") || pathname.startsWith("/auth/callback");

  // 1) Unauthenticated + protected => login
  if (authState === null) {
    return isProtected ? "/login" : null;
  }

  // 2) GOOGLE_AUTH_ONLY: allow onboarding routes only
  if (authState === "GOOGLE_AUTH_ONLY") {
    return isOnboarding ? null : "/onboarding/complete-profile";
  }

  // 3) ACTIVE: block onboarding routes => dashboard
  if (authState === "ACTIVE") {
    if (isOnboarding) {
      return role === "admin" ? "/admin" : "/dashboard";
    }

    // Keep admins inside admin routes (admins should not land on customer pages).
    if (role === "admin") {
      const isAdminArea = pathname === "/admin-profile" || pathname.startsWith("/admin");
      if (!isAdminArea) {
        return "/admin";
      }
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const effectiveRole: UserRole = role || "customer";
      const isAllowed = allowedRoles.includes(effectiveRole as any);
      if (!isAllowed) {
        if (effectiveRole === "admin") return "/admin";
        if (effectiveRole === "delivery") return "/delivery/dashboard";
        return "/dashboard";
      }
    }

    return null;
  }

  return null;
}
