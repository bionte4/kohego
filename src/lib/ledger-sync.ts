import {
  bindLedgerPush,
  clearLedgerDirty,
  flushDirtyLedgers,
  isLedgerDirty,
  ledgerPhase,
  scheduleLedgerPush,
  setLedgerPhase,
} from "@/lib/ledger-bus";
import { LEDGER_KEYS, type LedgerKey } from "@/lib/ledger";
import { getLivestockClient, parseLivestockBook, replaceLivestock } from "@/lib/livestock-store";
import { getPublisherClient, parsePublisherBook, replacePublisher } from "@/lib/publisher-store";
import { getClientSnapshot, parseSalesBook, replaceState } from "@/lib/storage";
import { getUsersClient, parseUsersBook, replaceUsers } from "@/lib/users-store";

type RemoteLedger = { revision: number; payload: unknown } | null;

const revisions: Record<LedgerKey, number> = {
  sales: 0,
  livestock: 0,
  publisher: 0,
  users: 0,
};

const readers: Record<LedgerKey, () => unknown> = {
  sales: getClientSnapshot,
  livestock: getLivestockClient,
  publisher: getPublisherClient,
  users: getUsersClient,
};

function adopt(key: LedgerKey, payload: unknown) {
  if (key === "sales") {
    const book = parseSalesBook(payload);
    if (book) replaceState(book, { quiet: true });
    return;
  }
  if (key === "livestock") {
    const book = parseLivestockBook(payload);
    if (book) replaceLivestock(book, { quiet: true });
    return;
  }
  if (key === "publisher") {
    const book = parsePublisherBook(payload);
    if (book) replacePublisher(book, { quiet: true });
    return;
  }
  const book = parseUsersBook(payload);
  if (book) replaceUsers(book, { quiet: true });
}

const retries = new Map<LedgerKey, number>();

async function push(key: LedgerKey) {
  try {
    const response = await fetch("/api/ledgers", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, revision: revisions[key], payload: readers[key]() }),
    });
    if (response.status === 503 || response.status === 403 || response.status === 400) {
      clearLedgerDirty(key);
      return;
    }
    const body = (await response.json().catch(() => null)) as { revision?: number; payload?: unknown } | null;
    if (response.status === 409 && body && typeof body.revision === "number") {
      revisions[key] = body.revision;
      if (body.payload) adopt(key, body.payload);
      clearLedgerDirty(key);
      retries.set(key, 0);
      return;
    }
    if (!response.ok || typeof body?.revision !== "number") return;
    revisions[key] = body.revision;
    clearLedgerDirty(key);
    retries.set(key, 0);
  } catch {
    const count = retries.get(key) ?? 0;
    if (count >= 2) return;
    retries.set(key, count + 1);
    window.setTimeout(() => scheduleLedgerPush(key), 3000);
  }
}

for (const key of LEDGER_KEYS) {
  bindLedgerPush(key, () => {
    void push(key);
  });
}

async function pull() {
  const response = await fetch("/api/ledgers");
  if (!response.ok) return;
  const body = (await response.json()) as { ledgers?: Partial<Record<LedgerKey, RemoteLedger>> };
  for (const key of LEDGER_KEYS) {
    const remote = body.ledgers?.[key];
    if (remote && typeof remote.revision === "number") {
      revisions[key] = remote.revision;
      if (isLedgerDirty(key)) scheduleLedgerPush(key);
      else adopt(key, remote.payload);
      continue;
    }
    revisions[key] = 0;
    scheduleLedgerPush(key);
  }
}

let started = false;

export function ledgerRevision(key: LedgerKey) {
  return revisions[key];
}

export function rememberLedgerRevision(key: LedgerKey, revision: number) {
  revisions[key] = revision;
  clearLedgerDirty(key);
}

export function startLedgerSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  setLedgerPhase("pulling");
  void pull()
    .catch(() => undefined)
    .finally(() => {
      setLedgerPhase("live");
      if (ledgerPhase() === "live") flushDirtyLedgers();
    });
}
