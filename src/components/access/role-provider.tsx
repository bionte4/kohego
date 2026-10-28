"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { can, isRole, type CrudAction, type Resource, type Role } from "@/lib/rbac";
import { getRoleClient, getRoleServer, roleEpoch, setStoredRole, subscribeRole } from "@/lib/role-store";

const RoleContext = createContext<Role | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribeRole, getRoleClient, getRoleServer);

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

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

export function useCan(resource: Resource, action: CrudAction) {
  const role = useRole();
  return role ? can(role, resource, action) : false;
}
