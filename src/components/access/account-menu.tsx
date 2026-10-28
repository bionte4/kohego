"use client";

import { Check, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/access/role-provider";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ROLE_ORDER: Role[] = ["SUPER_ADMIN", "FARM_MANAGER", "WAREHOUSE_ADMIN", "FIELD_SALES"];

export function AccountMenu() {
  const { role, user, switchable, switchRole, logout, switching, error } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const label = role ? ROLE_LABEL[role] : "Peran";

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 w-full max-w-[14rem] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm font-medium text-ink hover:border-forest-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-800/40 sm:max-w-[18rem]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-800 text-xs font-semibold text-white">
          {user.name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{user.name}</span>
          <span className="block truncate text-xs font-normal text-slate-500">{label}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={menuId} role="menu" className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <p className="px-3 py-2 text-xs text-slate-500">{user.email}</p>
          {switchable ? (
            <ul className="border-t border-slate-100 pt-1">
              {ROLE_ORDER.map((item) => {
                const selected = item === role;
                return (
                  <li key={item}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      disabled={switching}
                      onClick={() => {
                        setOpen(false);
                        void switchRole(item);
                      }}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm",
                        selected ? "bg-forest-50 font-medium" : "hover:bg-slate-50",
                      )}
                    >
                      {ROLE_LABEL[item]}
                      {selected ? <Check className="h-4 w-4 text-forest-800" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void logout().then(() => router.replace("/login"));
            }}
            className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium text-earth-800 hover:bg-earth-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Keluar
          </button>
          {error ? (
            <p role="alert" className="px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
