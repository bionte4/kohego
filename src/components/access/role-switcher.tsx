"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/access/role-provider";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ROLE_ORDER: Role[] = ["SUPER_ADMIN", "FARM_MANAGER", "FARM_KEEPER", "WAREHOUSE_ADMIN", "FIELD_SALES"];

const ROLE_HINT: Record<Role, string> = {
  SUPER_ADMIN: "Hulu, konversi, penjualan, dan kanal",
  FARM_MANAGER: "Ternak, kesehatan, dan kohe",
  FARM_KEEPER: "Pemeriksaan, jadwal pengobatan, dan kohe",
  WAREHOUSE_ADMIN: "Stok kemasan dan batch produksi",
  FIELD_SALES: "Pesanan dan mitra wilayah",
};

const ROLE_DOT: Record<Role, string> = {
  SUPER_ADMIN: "bg-forest-800",
  FARM_MANAGER: "bg-earth-800",
  FARM_KEEPER: "bg-earth-700",
  WAREHOUSE_ADMIN: "bg-earth-700",
  FIELD_SALES: "bg-forest-700",
};

export function RoleSwitcher() {
  const { role, switchRole, switching, error } = useAuth();
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

  const label = role ? ROLE_LABEL[role] : "Memuat peran";

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={!role || switching}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 w-full max-w-[11rem] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-ink hover:border-forest-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-800/40 disabled:opacity-50 sm:max-w-[16rem]"
      >
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", role ? ROLE_DOT[role] : "bg-slate-300")} aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && role ? (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Ganti peran"
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {ROLE_ORDER.map((item) => {
            const selected = item === role;
            return (
              <li key={item}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setOpen(false);
                    void switchRole(item);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                    selected ? "bg-forest-50" : "hover:bg-slate-50",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", ROLE_DOT[item])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{ROLE_LABEL[item]}</span>
                    <span className="block text-xs text-slate-500">{ROLE_HINT[item]}</span>
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-forest-800" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? (
        <span role="alert" className="absolute right-0 mt-1 w-64 text-right text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
