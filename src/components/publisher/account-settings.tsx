"use client";

import { KeyRound, RefreshCw } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { PLATFORM_LABEL, type SocialAccountList, type SocialAccountView, type SocialConnectionState } from "@/lib/social/types";

const STATUS_LABEL: Record<SocialConnectionState, string> = {
  CONNECTED: "Terhubung",
  EXPIRED: "Kedaluwarsa",
  DISCONNECTED: "Terputus",
};

const RESULT_COPY: Record<string, string> = {
  connected: "Akun tersambung. Token disimpan terenkripsi di server dan tidak dikirim ke browser.",
  denied: "Sambungan dibatalkan sebelum token diterima.",
  state: "Sesi masuk tidak cocok. Hubungkan ulang dari halaman ini.",
  exchange: "Penyedia menolak pertukaran token. Periksa izin aplikasi dan akun bisnis.",
  "missing-app": "Kunci aplikasi Meta atau TikTok belum diatur di server.",
};

function statusTone(status: SocialConnectionState) {
  if (status === "CONNECTED") return "forest" as const;
  if (status === "EXPIRED") return "earth" as const;
  return "slate" as const;
}

function subscribeToNothing() {
  return () => {};
}

function resultNotice() {
  const hasil = new URLSearchParams(window.location.search).get("hasil");
  return hasil ? (RESULT_COPY[hasil] ?? null) : null;
}

function emptyNotice() {
  return null;
}

export function AccountSettings() {
  const queryNotice = useSyncExternalStore(subscribeToNothing, resultNotice, emptyNotice);
  const [list, setList] = useState<SocialAccountList | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/social-accounts", { method: "POST" });
        const body = (await response.json()) as SocialAccountList;
        if (cancelled) return;
        if (!response.ok || !body.accounts) {
          setError("Status akun tidak dapat dimuat.");
          return;
        }
        setList(body);
      } catch {
        if (!cancelled) setError("Status akun tidak dapat dimuat.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshOne(account: SocialAccountView) {
    if (!account.id) return;
    setBusyId(account.id);
    setError(null);
    try {
      const response = await fetch(`/api/social-accounts/${account.id}/refresh`, { method: "POST" });
      const body = (await response.json()) as SocialAccountView & { message?: string };
      if (!response.ok) {
        setError(body.message ?? "Token tidak dapat diperbarui.");
        return;
      }
      setNotice(body.message ?? "Token diperbarui.");
      await loadAccounts(setList, setError);
    } catch {
      setError("Server tidak menjawab permintaan perbarui token.");
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(account: SocialAccountView) {
    if (!account.id) return;
    setBusyId(account.id);
    setError(null);
    try {
      const response = await fetch(`/api/social-accounts/${account.id}/disconnect`, { method: "POST" });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(body.message ?? "Akun tidak dapat diputus.");
        return;
      }
      setNotice("Akses dicabut di KoheGo. Token dihapus dari database.");
      await loadAccounts(setList, setError);
    } catch {
      setError("Server tidak menjawab permintaan putus akun.");
    } finally {
      setBusyId(null);
    }
  }

  const accounts = list?.accounts ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div>
            <CardTitle>Sambungan penerbit</CardTitle>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Instagram, Facebook, dan TikTok masuk lewat OAuth. Access token dan refresh token tinggal di server
              dalam bentuk terenkripsi. Threads tetap di antrian publisher, tanpa token di modul ini.
            </p>
          </div>
        </div>
        {list && !list.configured && list.message ? (
          <p className="mt-4 rounded-2xl bg-earth-50 px-4 py-3 text-sm leading-6 text-earth-900">{list.message}</p>
        ) : null}
        {notice ?? queryNotice ? (
          <p className="mt-4 rounded-2xl bg-forest-50 px-4 py-3 text-sm leading-6 text-forest-900">{notice ?? queryNotice}</p>
        ) : null}
        {error ? <p className="mt-4 rounded-2xl bg-earth-50 px-4 py-3 text-sm leading-6 text-earth-900">{error}</p> : null}
      </Card>

      {!list ? (
        <Card>
          <p className="text-sm text-slate-500">Memuat status sambungan…</p>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {accounts.map((account) => (
            <li key={`${account.platform}-${account.id ?? "baru"}`}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-forest-950">{PLATFORM_LABEL[account.platform]}</p>
                    <p className="text-sm text-slate-600">{account.accountName ?? "Belum terhubung"}</p>
                  </div>
                  <Badge tone={statusTone(account.status)}>{STATUS_LABEL[account.status]}</Badge>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {account.accessExpiresAt
                    ? `Access token berlaku sampai ${formatDateTime(account.accessExpiresAt)}.`
                    : "Belum ada masa berlaku token."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    className={buttonClass("primary", !list.configured ? "pointer-events-none opacity-50" : undefined)}
                    href={`/api/social-accounts/oauth/${account.platform}`}
                    aria-disabled={!list.configured}
                  >
                    {account.status === "DISCONNECTED" ? "Hubungkan" : "Hubungkan ulang"}
                  </a>
                  {account.canRefresh ? (
                    <Button
                      variant="secondary"
                      disabled={busyId === account.id}
                      onClick={() => void refreshOne(account)}
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      Perbarui token
                    </Button>
                  ) : null}
                  {account.id && account.status !== "DISCONNECTED" ? (
                    <Button variant="danger" disabled={busyId === account.id} onClick={() => void disconnect(account)}>
                      Putuskan
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function loadAccounts(
  setList: (value: SocialAccountList) => void,
  setError: (value: string | null) => void,
) {
  try {
    const response = await fetch("/api/social-accounts", { method: "POST" });
    const body = (await response.json()) as SocialAccountList;
    if (!response.ok || !body.accounts) {
      setError("Status akun tidak dapat dimuat.");
      return;
    }
    setList(body);
  } catch {
    setError("Status akun tidak dapat dimuat.");
  }
}
