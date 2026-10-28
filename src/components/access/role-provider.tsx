"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { can, isRole, type CrudAction, type Resource, type Role } from "@/lib/rbac";
import { clearStoredRole, getRoleClient, getRoleServer, roleEpoch, setStoredRole, subscribeRole } from "@/lib/role-store";

const RoleContext = createContext<Role | null>(null);

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

interface AuthActions {
  ready: boolean;
  user: SessionUser | null;
  switchable: boolean;
  switchRole: (next: Role) => Promise<void>;
  establish: (role: Role, user: SessionUser) => void;
  logout: () => Promise<void>;
  switching: boolean;
  error: string | null;
}

const AuthActionsContext = createContext<AuthActions | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribeRole, getRoleClient, getRoleServer);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [switchable, setSwitchable] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const seen = roleEpoch();
    fetch("/api/session")
      .then((response) => response.json())
      .then((body: { role?: unknown; user?: SessionUser | null; switchable?: boolean }) => {
        if (roleEpoch() !== seen) return;
        setSwitchable(body.switchable === true);
        if (!isRole(body.role) || !body.user?.id) {
          clearStoredRole();
          setUser(null);
          return;
        }
        setStoredRole(body.role);
        setUser({ id: body.user.id, name: body.user.name, email: body.user.email });
      })
      .catch(() => {
        if (roleEpoch() !== seen) return;
        clearStoredRole();
        setUser(null);
      })
      .finally(() => setReady(true));
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

  const establish = useCallback((next: Role, nextUser: SessionUser) => {
    setStoredRole(next);
    setUser(nextUser);
    setReady(true);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" });
    clearStoredRole();
    setUser(null);
  }, []);

  return (
    <RoleContext.Provider value={role}>
      <AuthActionsContext.Provider value={{ ready, user, switchable, switchRole, establish, logout, switching, error }}>
        {children}
      </AuthActionsContext.Provider>
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
