"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/access/role-provider";
import { AppShell } from "@/components/layout/app-shell";
import { LedgerSync } from "@/components/providers/ledger-sync";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const signingIn = pathname === "/login";

  useEffect(() => {
    if (!ready) return;
    if (!user && !signingIn) router.replace("/login");
    if (user && signingIn) router.replace("/dashboard");
  }, [ready, user, signingIn, router]);

  if (!ready) {
    return <p className="px-6 py-16 text-sm text-slate-500">Memeriksa sesi...</p>;
  }
  if (!user && !signingIn) return null;
  if (user && signingIn) return null;
  if (signingIn) return children;
  return (
    <>
      <LedgerSync />
      <AppShell>{children}</AppShell>
    </>
  );
}
