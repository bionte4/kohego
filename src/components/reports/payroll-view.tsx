"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/access/role-provider";
import { useStoreState } from "@/components/providers/store-provider";
import { RoleBadge } from "@/components/settings/role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlClass } from "@/components/ui/field";
import { formatIdr } from "@/lib/format";
import { getLivestockClient, getLivestockServer, subscribeLivestock } from "@/lib/livestock-store";
import {
  BASE_SALARY_IDR,
  COMMISSION_IDR_PER_KG,
  compilePayroll,
  HEALTH_BONUS_IDR_PER_HEAD,
  markSlipPaid,
  periodLabel,
  shiftPeriod,
  SUCCESSFUL_HEALTH_SCORE,
  type PayrollSlip,
} from "@/lib/payroll";
import { getPayrollClient, getPayrollServer, replacePayrollPeriod, subscribePayroll } from "@/lib/payroll-store";
import { getUsersClient, getUsersServer, subscribeUsers } from "@/lib/users-store";

interface DraftMoney {
  base: string;
  deductions: string;
}

export function PayrollView() {
  const auth = useAuth();
  const store = useStoreState();
  const users = useSyncExternalStore(subscribeUsers, getUsersClient, getUsersServer);
  const herd = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const savedBook = useSyncExternalStore(subscribePayroll, getPayrollClient, getPayrollServer);
  const [period, setPeriod] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftMoney>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
    setPeriod(formatted.slice(0, 7));
  }, []);

  useEffect(() => {
    if (!period || auth.role !== "SUPER_ADMIN") return;
    let cancelled = false;
    fetch(`/api/reports/payroll?period=${period}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { slips?: PayrollSlip[]; stored?: boolean } | null;
        if (!response.ok || !body?.slips || cancelled) return;
        if (body.stored && body.slips.length > 0) replacePayrollPeriod(period, body.slips);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [period, auth.role]);

  const saved = useMemo(() => (savedBook && period ? savedBook.records.filter((item) => item.period === period) : []), [savedBook, period]);
  const compiled = useMemo(() => {
    if (!period || !users || !herd || !store.ready) return null;
    const locked = saved.filter((item) => item.status === "PAID");
    const baseInput = {
      period,
      users: users.users,
      orders: store.orders,
      healthLogs: herd.healthLogs ?? [],
      animals: herd.animals,
      waste: herd.waste,
      locked,
    };
    const live = compilePayroll({ ...baseInput, adjustments: adjustmentsFrom(drafts, users.users, saved) });
    if (live.ok) return { message: null as string | null, value: live.value };
    const fallback = compilePayroll(baseInput);
    if (!fallback.ok) return { message: live.message, value: null };
    return { message: live.message, value: fallback.value };
  }, [period, users, herd, store, drafts, saved]);

  if (!auth.ready || !period || !users || !herd || !store.ready || !savedBook || !compiled || !compiled.value) {
    return <p className="text-sm text-slate-500">Menyiapkan penggajian...</p>;
  }
  if (auth.role !== "SUPER_ADMIN") {
    return <p className="text-sm text-slate-600">Penggajian hanya untuk super admin.</p>;
  }

  const slips = compiled.value.slips;
  const pendingNet = slips.filter((item) => item.status === "PENDING").reduce((sum, item) => sum + item.netPayIdr, 0);
  const paidNet = slips.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.netPayIdr, 0);

  async function commit(payUserId?: string) {
    if (!period || !users || !herd || !store.ready || !compiled?.value) return;
    setBusy(payUserId ?? "save");
    setError(null);
    setNotice(null);
    const paidAt = new Date().toISOString();
    const next = compiled.value.slips.map((slip) => (payUserId && slip.userId === payUserId ? markSlipPaid(slip, paidAt) : slip));
    try {
      const response = await fetch("/api/reports/payroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period,
          sales: store,
          livestock: herd,
          users,
          adjustments: adjustmentsFrom(drafts, users.users, saved),
          payUserId: payUserId || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string; slips?: PayrollSlip[]; stored?: boolean } | null;
      if (!response.ok || !body?.slips) {
        setError(body?.message ?? "Rekap gaji tidak tersimpan.");
        return;
      }
      replacePayrollPeriod(period, body.slips);
      setNotice(body.stored ? "Rekap tersimpan." : "Rekap tersimpan di perangkat. Database belum mencatat slip ini.");
    } catch {
      replacePayrollPeriod(period, next);
      setNotice("Rekap tersimpan di perangkat.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MonthBar period={period} onShift={(delta) => setPeriod(shiftPeriod(period, delta))} />
        <Button className="w-full sm:w-auto" disabled={busy !== null || compiled.message !== null} onClick={() => void commit()}>
          Simpan rekap
        </Button>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Komisi penjualan bertingkat: Rp 200, Rp {COMMISSION_IDR_PER_KG.toLocaleString("id-ID")}, atau Rp 300 per kilogram pupuk padat. Bonus manajer kandang menggabungkan pemeriksaan skor minimal {SUCCESSFUL_HEALTH_SCORE} (Rp{" "}
        {HEALTH_BONUS_IDR_PER_HEAD.toLocaleString("id-ID")} per ternak), pemulihan dari skor rendah, dan akurasi catatan kohe dalam 15%.
      </p>
      {compiled.value.unassignedOrders > 0 || compiled.value.unassignedHealth > 0 ? (
        <p className="rounded-2xl border border-earth-100 bg-earth-50 px-4 py-3 text-sm leading-6 text-earth-900">
          {compiled.value.unassignedOrders > 0
            ? `${compiled.value.unassignedOrders} pesanan belum tertaut ke petugas penjualan.`
            : "Semua pesanan bulan ini sudah tertaut."}{" "}
          {compiled.value.unassignedHealth > 0 ? `${compiled.value.unassignedHealth} pemeriksaan sehat belum tertaut ke manajer kandang.` : ""}
        </p>
      ) : null}
      {compiled.message ? (
        <p role="alert" className="text-sm text-red-700">
          {compiled.message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-forest-800">{notice}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Gaji bersih</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-800">{formatIdr(pendingNet + paidNet)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Menunggu bayar</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-earth-800">{formatIdr(pendingNet)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Sudah dibayar</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatIdr(paidNet)}</p>
        </Card>
      </div>
      <ul className="space-y-3">
        {slips.map((slip) => (
          <li key={slip.id}>
            <SlipCard
              slip={slip}
              draft={drafts[slip.userId]}
              busy={busy === slip.userId || compiled.message !== null}
              onDraft={(next) => setDrafts((current) => ({ ...current, [slip.userId]: next }))}
              onPay={() => void commit(slip.userId)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthBar({ period, onShift }: { period: string; onShift: (delta: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 bg-white" onClick={() => onShift(-1)} aria-label="Bulan sebelumnya">
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <p className="min-w-40 text-center font-display text-xl text-ink">{periodLabel(period)}</p>
      <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 bg-white" onClick={() => onShift(1)} aria-label="Bulan berikutnya">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

function SlipCard({
  slip,
  draft,
  busy,
  onDraft,
  onPay,
}: {
  slip: PayrollSlip;
  draft?: DraftMoney;
  busy: boolean;
  onDraft: (next: DraftMoney) => void;
  onPay: () => void;
}) {
  const paid = slip.status === "PAID";
  const base = paid ? String(slip.baseSalaryIdr) : draft?.base ?? String(slip.baseSalaryIdr);
  const deductions = paid ? String(slip.deductionsIdr) : draft?.deductions ?? String(slip.deductionsIdr);
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl text-ink">{slip.name}</h2>
            <RoleBadge role={slip.role} />
            <Badge tone={paid ? "forest" : "earth"}>{paid ? "Lunas" : "Menunggu"}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{slip.email}</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-forest-800">{formatIdr(slip.netPayIdr)}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Gaji pokok
          <input
            inputMode="numeric"
            className={`${controlClass} mt-1.5`}
            value={base}
            disabled={paid}
            onChange={(event) => onDraft({ base: event.target.value.replace(/[^\d]/g, ""), deductions })}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Potongan
          <input
            inputMode="numeric"
            className={`${controlClass} mt-1.5`}
            value={deductions}
            disabled={paid}
            onChange={(event) => onDraft({ base, deductions: event.target.value.replace(/[^\d]/g, "") })}
          />
        </label>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {slip.lines.map((line) => (
          <div key={line.label} className="rounded-xl bg-forest-50 px-3 py-3">
            <dt className="text-sm text-slate-600">{line.label}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">{formatIdr(line.amountIdr)}</dd>
            <dd className="mt-1 text-xs leading-5 text-slate-500">{line.detail}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Kotor {formatIdr(slip.grossIdr)}
          {slip.paidAt ? ` · dibayar ${slip.paidAt.slice(0, 10)}` : ""}
        </p>
        {paid ? null : (
          <Button variant="secondary" disabled={busy} onClick={onPay}>
            Tandai lunas
          </Button>
        )}
      </div>
    </Card>
  );
}

function adjustmentsFrom(drafts: Record<string, DraftMoney>, users: { id: string; role: PayrollSlip["role"]; active: boolean }[], saved: PayrollSlip[]) {
  return users
    .filter((user) => user.active)
    .map((user) => {
      const draft = drafts[user.id];
      const previous = saved.find((item) => item.userId === user.id);
      const base = draft ? Number(draft.base || "0") : previous?.baseSalaryIdr ?? BASE_SALARY_IDR[user.role];
      const deductions = draft ? Number(draft.deductions || "0") : previous?.deductionsIdr ?? 0;
      return { userId: user.id, baseSalaryIdr: base, deductionsIdr: deductions };
    });
}
