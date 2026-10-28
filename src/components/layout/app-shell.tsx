"use client";

import { ChevronDown, ChevronRight, PanelLeft, Sprout } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { RoleSwitcher } from "@/components/access/role-switcher";
import { ResetDemoButton } from "@/components/layout/reset-demo-button";
import { MOBILE_NAV, MODULE_NAV, NAV_GROUPS, NAV_ITEMS, isActive, type NavGroupId } from "@/components/layout/nav";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function subscribeToNothing() {
  return () => {};
}

function todayLabel() {
  return formatLongDate(new Date());
}

function emptyDateLabel() {
  return "";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href)) ?? NAV_ITEMS[0];
  const today = useSyncExternalStore(subscribeToNothing, todayLabel, emptyDateLabel);
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState<NavGroupId[]>([]);

  function toggleGroup(id: NavGroupId) {
    setClosedGroups((currentGroups) =>
      currentGroups.includes(id) ? currentGroups.filter((group) => group !== id) : [...currentGroups, id],
    );
  }

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3"
      >
        Loncat ke konten
      </a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-forest-950 text-white md:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <div className={cn("flex items-center gap-3 px-3 py-5", collapsed ? "justify-center" : "px-4")}>
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-800"
            aria-label="Dasbor Kohego"
          >
            <Sprout className="h-5 w-5" aria-hidden />
          </Link>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="font-display text-2xl leading-none">Kohego</p>
              <p className="mt-1 text-xs text-emerald-100/80">Pupuk organik</p>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto px-3" aria-label="Utama">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((item) => item.group === group.id);
            const open = collapsed || !closedGroups.includes(group.id);
            return (
              <div key={group.id}>
                {collapsed ? null : (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.id)}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-xs font-semibold tracking-wide text-emerald-100/60 uppercase"
                  >
                    {group.label}
                    <ChevronDown className={cn("h-4 w-4 transition", open ? "rotate-0" : "-rotate-90")} aria-hidden />
                  </button>
                )}
                {open ? (
                  <div className="space-y-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          aria-label={collapsed ? item.label : undefined}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                            collapsed && "justify-center px-0",
                            active ? "bg-white/10 text-white" : "text-emerald-50/75 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden />
                          {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="space-y-2 px-3 pb-4">
          {collapsed ? null : (
            <p className="px-3 text-xs leading-5 text-emerald-100/70">
              Data tersimpan di perangkat ini, termasuk saat offline.
            </p>
          )}
          <ResetDemoButton
            compact={collapsed}
            className={cn(
              "text-emerald-50/80 hover:bg-white/10",
              collapsed ? "w-11 justify-center" : "w-full px-3",
            )}
          />
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-pressed={collapsed}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-emerald-50/80 hover:bg-white/10",
              collapsed && "justify-center px-0",
            )}
          >
            <PanelLeft className="h-5 w-5 shrink-0" aria-hidden />
            {collapsed ? <span className="sr-only">Lebarkan menu</span> : "Ciutkan menu"}
          </button>
        </div>
      </aside>

      <div className={cn(collapsed ? "md:pl-[4.5rem]" : "md:pl-64")}>
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-paper/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 md:px-8">
            <Link
              href="/"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-800 text-white md:hidden"
              aria-label="Dasbor"
            >
              <Sprout className="h-5 w-5" aria-hidden />
            </Link>
            <div className="min-w-0 flex-1">
              <nav aria-label="Jejak">
                <ol className="flex items-center gap-1 text-xs text-slate-500">
                  <li>
                    <Link href="/" className="hover:text-forest-800">
                      Kohego
                    </Link>
                  </li>
                  <li aria-hidden className="flex items-center">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                  <li className="truncate font-medium text-ink" aria-current="page">
                    {current?.title}
                  </li>
                </ol>
              </nav>
              <h1 className="truncate font-display text-xl leading-tight">{current?.title}</h1>
              <p className="truncate text-sm text-slate-500">{current?.subtitle}</p>
            </div>
            {today ? <p className="hidden text-right text-sm text-slate-500 lg:block">{today}</p> : null}
            <RoleSwitcher />
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
            {MODULE_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium",
                    active ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.shortLabel}
                </Link>
              );
            })}
          </div>
        </header>
        <main
          id="konten"
          className="mx-auto w-full max-w-7xl px-4 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-10"
        >
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Utama"
      >
        <ul className="grid grid-cols-4">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                    active ? "text-forest-800" : "text-slate-500",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {item.shortLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
