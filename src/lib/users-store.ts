import { noteLedgerWrite } from "@/lib/ledger-bus";
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

export function parseUsersBook(input: unknown): StaffDirectory | null {
  if (!input || typeof input !== "object") return null;
  const parsed = input as { version?: number; users?: unknown };
  if (parsed.version !== 1 || !Array.isArray(parsed.users) || !parsed.users.every(isUser)) return null;
  return { version: 1, users: parsed.users };
}

export function loadUsers(): StaffDirectory {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return createUserSeed();
    return parseUsersBook(JSON.parse(raw) as unknown) ?? createUserSeed();
  } catch {
    return createUserSeed();
  }
}

let quietWrites = false;

export function saveUsers(directory: StaffDirectory) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(directory));
    if (!quietWrites) noteLedgerWrite("users");
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

export function replaceUsers(next: StaffDirectory, options?: { quiet?: boolean }) {
  const previous = quietWrites;
  quietWrites = options?.quiet ?? false;
  memory = next;
  const saved = saveUsers(next);
  quietWrites = previous;
  listeners.forEach((listener) => listener());
  return saved;
}
