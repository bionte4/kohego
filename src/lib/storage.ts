import { createSeed } from "@/lib/seed";
import type { AppData } from "@/lib/types";

export const STORAGE_KEY = "kohego.dashboard.v2";

export function loadState(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeed();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (
      parsed.version !== 2 ||
      !Array.isArray(parsed.orders) ||
      !Array.isArray(parsed.partners) ||
      !Array.isArray(parsed.warehouses) ||
      !Array.isArray(parsed.stock) ||
      !Array.isArray(parsed.movements) ||
      !parsed.profile ||
      typeof parsed.profile !== "object" ||
      typeof parsed.profile.name !== "string"
    ) {
      return createSeed();
    }
    return parsed as AppData;
  } catch {
    return createSeed();
  }
}

export function saveState(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

let memory: AppData | null = null;
let wroteInitial = false;
const listeners = new Set<() => void>();

export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Browser snapshot. The first read also writes the seed so a refresh stays stable. */
export function getClientSnapshot() {
  if (!memory || memory.version !== 2) {
    memory = loadState();
    wroteInitial = false;
  }
  if (!wroteInitial) {
    wroteInitial = true;
    saveState(memory);
  }
  return memory;
}

export function getServerSnapshot(): AppData | null {
  return null;
}

export function replaceState(next: AppData) {
  memory = next;
  const saved = saveState(next);
  listeners.forEach((listener) => listener());
  return saved;
}
