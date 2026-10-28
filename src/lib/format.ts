const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIdr(value: number) {
  return idr.format(value);
}

export function formatIdrCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} M`;
  }
  if (abs >= 1_000_000) {
    return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value / 1_000_000)} jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value / 1_000)} rb`;
  }
  return formatIdr(value);
}

/** Liters of liquid fertilizer. Whole liters above 10, one decimal below. */
export function formatVolume(liters: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: liters >= 10 ? 0 : 1 }).format(liters)} L`;
}

/** Kilograms under one ton stay in kg. Larger masses use one decimal ton. */
export function formatWeight(kg: number) {
  if (kg >= 1000) {
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(kg / 1000)} ton`;
  }
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(kg)} kg`;
}

export function formatPercent(ratio: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);
}

export function formatDelta(ratio: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "always",
  }).format(ratio);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function isSameDay(iso: string, now: Date) {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export function mapsHref(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
