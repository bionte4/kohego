"use client";

import { useState } from "react";
import { useRole } from "@/components/access/role-provider";
import { isRole, ROLE_LABEL, ROLES } from "@/lib/rbac";
import { setStoredRole } from "@/lib/role-store";

export function RoleSwitcher() {
  const role = useRole();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: string) {
    if (!isRole(next) || next === role) return;
    setPending(true);
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
      setPending(false);
    }
  }

  return (
    <label className="block min-w-0 max-w-xs flex-1">
      <span className="sr-only">Peran uji</span>
      <select
        aria-label="Peran uji"
        value={role ?? ""}
        disabled={!role || pending}
        onChange={(event) => {
          void onChange(event.target.value);
        }}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink"
      >
        {role ? null : <option value="">Memuat peran</option>}
        {ROLES.map((item) => (
          <option key={item} value={item}>
            {ROLE_LABEL[item]}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}
