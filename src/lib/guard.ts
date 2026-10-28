import {
  can,
  denialMessage,
  isRole,
  type CrudAction,
  type Resource,
  type Role,
} from "@/lib/rbac";
import { getRoleClient, setStoredRole } from "@/lib/role-store";

const METHOD: Record<CrudAction, "GET" | "POST" | "PATCH" | "DELETE"> = {
  create: "POST",
  read: "GET",
  update: "PATCH",
  delete: "DELETE",
};

/**
 * Asks the API before a local ledger write. A network failure keeps the
 * device role so field sales can still log orders offline. A 403 always blocks.
 */
export async function guard(resource: Resource, action: CrudAction, body?: unknown): Promise<string | null> {
  const role = getRoleClient();
  if (!role) return "Peran belum dimuat.";
  if (!can(role, resource, action)) return denialMessage(role, resource, action);

  const path = resource === "production" ? "/api/access" : `/api/${resource}`;
  const payload = resource === "production" ? { resource, action } : (body ?? {});
  try {
    const response = await fetch(path, {
      method: METHOD[action],
      headers: { "content-type": "application/json" },
      body: action === "read" ? undefined : JSON.stringify(payload),
    });
    if (response.ok) return null;
    const result = (await response.json().catch(() => null)) as { message?: string; role?: string } | null;
    if (response.status === 403 && isRole(result?.role)) setStoredRole(result.role);
    return result?.message ?? "Akses ditolak.";
  } catch {
    return null;
  }
}

export function syncRole(role: Role) {
  setStoredRole(role);
}
