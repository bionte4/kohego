import type { LedgerKey } from "@/lib/ledger";

type Phase = "boot" | "pulling" | "live";

let phase: Phase = "boot";
const dirty = new Set<LedgerKey>();
const timers = new Map<LedgerKey, number>();
const jobs = new Map<LedgerKey, () => void>();

export function setLedgerPhase(next: Phase) {
  phase = next;
}

export function ledgerPhase() {
  return phase;
}

export function isLedgerDirty(key: LedgerKey) {
  return dirty.has(key);
}

export function clearLedgerDirty(key: LedgerKey) {
  dirty.delete(key);
}

export function noteLedgerWrite(key: LedgerKey) {
  if (typeof window === "undefined" || phase === "boot") return;
  dirty.add(key);
  if (phase === "live") scheduleLedgerPush(key);
}

export function bindLedgerPush(key: LedgerKey, job: () => void) {
  jobs.set(key, job);
}

export function scheduleLedgerPush(key: LedgerKey) {
  if (typeof window === "undefined") return;
  const previous = timers.get(key);
  if (previous) window.clearTimeout(previous);
  const timer = window.setTimeout(() => {
    timers.delete(key);
    jobs.get(key)?.();
  }, 400);
  timers.set(key, timer);
}

export function flushDirtyLedgers() {
  for (const key of dirty) scheduleLedgerPush(key);
}
