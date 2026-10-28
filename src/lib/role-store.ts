import { isRole, type Role } from "@/lib/rbac";

const KEY = "kohego.role.v1";

let memory: Role | null = null;
let epoch = 0;
const listeners = new Set<() => void>();

function readStored(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return isRole(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function roleEpoch() {
  return epoch;
}

export function getRoleClient(): Role | null {
  if (memory) return memory;
  memory = readStored();
  return memory;
}

export function getRoleServer(): Role | null {
  return null;
}

export function setStoredRole(role: Role) {
  epoch += 1;
  memory = role;
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    // The cookie remains the server session even when the device store is blocked.
  }
  listeners.forEach((listener) => listener());
}

export function clearStoredRole() {
  epoch += 1;
  memory = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // The cookie is cleared by the server even when the device store is blocked.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeRole(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
