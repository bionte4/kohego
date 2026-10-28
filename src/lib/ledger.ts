import { can, type Role } from "@/lib/rbac";

export const LEDGER_KEYS = ["sales", "livestock", "publisher", "users"] as const;

export type LedgerKey = (typeof LEDGER_KEYS)[number];

export function isLedgerKey(value: unknown): value is LedgerKey {
  return typeof value === "string" && (LEDGER_KEYS as readonly string[]).includes(value);
}

/** A role may store a book when that role is already allowed to change something inside it. */
export function canWriteLedger(role: Role, key: LedgerKey) {
  if (key === "sales") {
    return (
      can(role, "orders", "create") ||
      can(role, "inventory", "update") ||
      can(role, "partners", "create") ||
      can(role, "sites", "create") ||
      can(role, "catalog", "create")
    );
  }
  if (key === "livestock") return can(role, "livestock", "update") || can(role, "production", "create");
  if (key === "publisher") return role === "SUPER_ADMIN";
  return can(role, "users", "update");
}
