import { createUserSeed, type StaffDirectory, type StaffUser } from "@/lib/users";
import { isRole } from "@/lib/rbac";

export const USERS_KEY = "kohego.users.v1";

function isUser(value: unknown): value is StaffUser {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StaffUser>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.email === "string" &&
    isRole(row.role) &&
    typeof row.active === "boolean" &&
    typeof row.updatedAt === "string"
  );
}

export function loadUsers(): StaffDirectory {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return createUserSeed();
    const parsed = JSON.parse(raw) as { version?: number; users?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.users) || !parsed.users.every(isUser)) {
      return createUserSeed();
    }
    return { version: 1, users: parsed.users };
  } catch {
    return createUserSeed();
  }
}

export function saveUsers(directory: StaffDirectory) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(directory));
    return true;
  } catch {
    return false;
  }
}

let memory: StaffDirectory | null = null;
let wroteInitial = false;
const listeners = new Set<() => void>();

export function subscribeUsers(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUsersClient() {
  if (!memory || memory.version !== 1) {
    memory = loadUsers();
    wroteInitial = false;
  }
  if (!wroteInitial) {
    wroteInitial = true;
    saveUsers(memory);
  }
  return memory;
}

export function getUsersServer(): StaffDirectory | null {
  return null;
}

export function replaceUsers(next: StaffDirectory) {
  memory = next;
  const saved = saveUsers(next);
  listeners.forEach((listener) => listener());
  return saved;
}
