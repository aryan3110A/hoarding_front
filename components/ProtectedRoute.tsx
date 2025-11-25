"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout, { useUser } from "./AppLayout";
import AccessDenied from "./AccessDenied";
import { canAccess, getRoleFromUser } from "@/lib/rbac";

interface ProtectedRouteProps {
  children: React.ReactNode;
  component: string;
  requireAuth?: boolean;
}

export default function ProtectedRoute({
  children,
  component,
  requireAuth = true,
}: ProtectedRouteProps) {
  const userFromContext = useUser();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  // Get user from context or localStorage as fallback
  useEffect(() => {
    console.log("🔐 [ProtectedRoute] Component:", component);
    console.log("🔐 [ProtectedRoute] User from context:", userFromContext);
    console.log("🔐 [ProtectedRoute] RequireAuth:", requireAuth);

    // Prefer context user if available
    if (userFromContext) {
      console.log(
        "🔐 [ProtectedRoute] User found in context:",
        userFromContext
      );
      setUser(userFromContext);
      setCheckingUser(false);
      return;
    }

    // If not in context yet, check localStorage directly
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("🔐 [ProtectedRoute] No token found, redirecting to login");
      if (requireAuth) {
        router.push("/login");
      }
      setCheckingUser(false);
      return;
    }

    const userData = localStorage.getItem("user");
    console.log("🔐 [ProtectedRoute] Checking localStorage for user data...");
    console.log("🔐 [ProtectedRoute] User data exists:", !!userData);

    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log(
          "🔐 [ProtectedRoute] User found in localStorage:",
          parsedUser
        );
        console.log(
          "🔐 [ProtectedRoute] User role from localStorage:",
          parsedUser.role
        );
        setUser(parsedUser);
        setCheckingUser(false);
      } catch (error) {
        console.error(
          "🔐 [ProtectedRoute] Error parsing user from localStorage:",
          error
        );
        if (requireAuth) {
          router.push("/login");
        }
        setCheckingUser(false);
      }
    } else {
      console.log("🔐 [ProtectedRoute] No user data in localStorage");
      console.log(
        "🔐 [ProtectedRoute] Available localStorage keys:",
        Object.keys(localStorage)
      );
      // Wait a bit for AppLayout to potentially load the user
      // This handles the race condition where ProtectedRoute checks before AppLayout loads
      const timeoutId = setTimeout(() => {
        const retryUserData = localStorage.getItem("user");
        if (retryUserData) {
          try {
            const parsedUser = JSON.parse(retryUserData);
            console.log("🔐 [ProtectedRoute] User found on retry:", parsedUser);
            setUser(parsedUser);
            setCheckingUser(false);
            return;
          } catch (error) {
            console.error("🔐 [ProtectedRoute] Error on retry:", error);
          }
        }
        if (requireAuth) {
          console.log(
            "🔐 [ProtectedRoute] Still no user after retry, redirecting to login"
          );
          router.push("/login");
        }
        setCheckingUser(false);
      }, 100); // Wait 100ms for AppLayout to load

      // Cleanup timeout if component unmounts or dependencies change
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [userFromContext, requireAuth, router, component]);

  // Update user when context user becomes available (prefer context over localStorage)
  useEffect(() => {
    if (userFromContext && userFromContext !== user) {
      console.log(
        "🔐 [ProtectedRoute] User updated from context:",
        userFromContext
      );
      setUser(userFromContext);
      setCheckingUser(false);
    }
  }, [userFromContext, user]);

  if (checkingUser) {
    console.log("🔐 [ProtectedRoute] Checking user, showing loading...");
    return null; // Still checking
  }

  if (requireAuth && !user) {
    console.log(
      "🔐 [ProtectedRoute] No user found after check, returning null"
    );
    return null; // Will redirect
  }

  // Safely extract role from user object
  const userRole = getRoleFromUser(user);
  console.log("🔐 [ProtectedRoute] Extracted role:", userRole);
  console.log(
    "🔐 [ProtectedRoute] User object keys:",
    user ? Object.keys(user) : "No user"
  );
  console.log("🔐 [ProtectedRoute] User role property value:", user?.role);
  console.log("🔐 [ProtectedRoute] Full user object:", user);

  // Check access only if user exists and has a role
  if (user && userRole) {
    console.log(
      "🔐 [ProtectedRoute] Checking access for role:",
      userRole,
      "to component:",
      component
    );
    const hasAccess = canAccess(userRole, component);
    console.log("🔐 [ProtectedRoute] Access result:", hasAccess);

    if (!hasAccess) {
      console.warn(
        `🚫 [ProtectedRoute] Access DENIED for role "${userRole}" to component "${component}"`
      );
      console.warn("🚫 [ProtectedRoute] User details:", {
        id: user?.id,
        email: user?.email,
        role: userRole,
        userRoleProperty: user?.role,
        fullUser: user,
      });
      // Additional debugging - check what permissions exist for this role
      console.warn("🚫 [ProtectedRoute] Debugging permission check...");
      return <AccessDenied />;
    }
    console.log(
      "✅ [ProtectedRoute] Access GRANTED for role:",
      userRole,
      "to component:",
      component
    );
  } else if (user && !userRole) {
    // User exists but no role - deny access for security
    console.error("🚫 [ProtectedRoute] User exists but has no role assigned");
    console.error("🚫 [ProtectedRoute] User object:", user);
    console.error("🚫 [ProtectedRoute] User.role value:", user?.role);
    console.error("🚫 [ProtectedRoute] User.role type:", typeof user?.role);
    console.error(
      "🚫 [ProtectedRoute] User object structure:",
      JSON.stringify(user, null, 2)
    );
    return <AccessDenied />;
  } else if (!user) {
    console.error("🚫 [ProtectedRoute] No user object available");
  }

  return <>{children}</>;
}
