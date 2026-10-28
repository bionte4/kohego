const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;

interface Bucket {
  fails: number;
  windowStart: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

export function loginRateKey(request: Request, email: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "local";
  return `${ip}:${email.trim().toLowerCase()}`;
}

export function loginBlockMessage(key: string) {
  const row = buckets.get(key);
  if (!row || row.lockedUntil <= Date.now()) return null;
  const minutes = Math.max(1, Math.ceil((row.lockedUntil - Date.now()) / 60000));
  return `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`;
}

export function noteLoginFailure(key: string) {
  const now = Date.now();
  const row = buckets.get(key);
  if (!row || now - row.windowStart > WINDOW_MS) {
    buckets.set(key, { fails: 1, windowStart: now, lockedUntil: 0 });
    return;
  }
  row.fails += 1;
  if (row.fails >= MAX_FAILS) row.lockedUntil = now + LOCK_MS;
}

export function noteLoginSuccess(key: string) {
  buckets.delete(key);
}
