"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { can, isRole, type CrudAction, type Resource, type Role } from "@/lib/rbac";
import { getRoleClient, getRoleServer, roleEpoch, setStoredRole, subscribeRole } from "@/lib/role-store";

const RoleContext = createContext<Role | null>(null);

interface AuthActions {
  switchRole: (next: Role) => Promise<void>;
  switching: boolean;
  error: string | null;
}

const AuthActionsContext = createContext<AuthActions | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribeRole, getRoleClient, getRoleServer);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const seen = roleEpoch();
    fetch("/api/session")
      .then((response) => response.json())
      .then((body: { role?: unknown }) => {
        if (roleEpoch() !== seen || !isRole(body.role)) return;
        setStoredRole(body.role);
      })
      .catch(() => {
        if (roleEpoch() !== seen || getRoleClient()) return;
        setStoredRole("SUPER_ADMIN");
      });
  }, []);

  const switchRole = useCallback(async (next: Role) => {
    if (next === getRoleClient()) return;
    setSwitching(true);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const body = (await response.json().catch(() => null)) as { role?: unknown; message?: string } | null;
      if (!response.ok || !isRole(body?.role)) {
        setError(body?.message ?? "Peran tidak dapat diganti.");
        return;
      }
      setStoredRole(body.role);
      setError(null);
    } catch {
      setError("Peran tidak dapat diganti saat offline.");
    } finally {
      setSwitching(false);
    }
  }, []);

  return (
    <RoleContext.Provider value={role}>
      <AuthActionsContext.Provider value={{ switchRole, switching, error }}>{children}</AuthActionsContext.Provider>
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

export function useAuth() {
  const role = useRole();
  const actions = useContext(AuthActionsContext);
  if (!actions) {
    throw new Error("useAuth harus dipakai di dalam RoleProvider.");
  }
  return { role, ...actions };
}

export function useCan(resource: Resource, action: CrudAction) {
  const role = useRole();
  return role ? can(role, resource, action) : false;
}
