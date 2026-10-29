"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRole } from "@/components/access/role-provider";
import { getLivestockClient, getLivestockServer, subscribeLivestock } from "@/lib/livestock-store";
import { barnNotices, type NoticeKind } from "@/lib/notices";
import { getClientSnapshot, getServerSnapshot, subscribeStore } from "@/lib/storage";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<NoticeKind, string> = {
  tugas: "Tugas",
  peringatan: "Peringatan",
  status: "Status",
};

export function NoticeBell() {
  const role = useRole();
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const sales = useSyncExternalStore(subscribeStore, getClientSnapshot, getServerSnapshot);
  const [clock, setClock] = useState<{ today: string; nowIso: string } | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    setClock({ today, nowIso: now.toISOString() });
  }, []);

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

  const items = barnNotices({ role, book, sales, today: clock?.today ?? null, nowIso: clock?.nowIso ?? null });
  const urgent = items.filter((item) => item.urgent).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-ink hover:border-forest-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-800/40"
      >
        <Bell className="h-5 w-5" aria-hidden />
        <span className="sr-only">{urgent > 0 ? `${urgent} notifikasi perlu tindakan` : "Notifikasi"}</span>
        {urgent > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-earth-800 px-1 text-[10px] font-semibold text-white">
            {urgent}
          </span>
        ) : null}
      </button>
      {open ? (
        <div id={menuId} role="dialog" aria-label="Notifikasi" className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          {items.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">Memuat notifikasi...</p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 flex-col justify-center rounded-xl px-3 py-2 hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        item.kind === "tugas" && "text-forest-800",
                        item.kind === "peringatan" && "text-earth-800",
                        item.kind === "status" && "text-slate-500",
                      )}
                    >
                      {KIND_LABEL[item.kind]}
                    </span>
                    <span className="text-sm leading-5 text-ink">{item.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
