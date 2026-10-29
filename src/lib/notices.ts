import { lowStockLimit, PRODUCTS } from "@/lib/catalog";
import { activeHolds } from "@/lib/withdrawal";
import { CARE_LABEL, effectiveCareStatus } from "@/lib/medical-schedule";
import type { LivestockBook } from "@/lib/livestock";
import type { Role } from "@/lib/rbac";
import type { AppData } from "@/lib/types";

export type NoticeKind = "tugas" | "peringatan" | "status";

export interface BarnNotice {
  id: string;
  kind: NoticeKind;
  text: string;
  href: string;
  urgent: boolean;
}

const LIMIT = 80;

/** Keeps a bell line inside one phone row. */
export function fitNotice(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if ([...clean].length <= LIMIT) return clean;
  return [...clean].slice(0, LIMIT - 1).join("").trimEnd() + "…";
}

function line(id: string, kind: NoticeKind, text: string, href: string, urgent: boolean): BarnNotice {
  return { id, kind, text: fitNotice(text), href, urgent };
}

function shortPen(name: string) {
  return name.replace(/^Kandang\s+/i, "");
}

function shortDate(iso: string) {
  const [year, month, day] = iso.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const index = Number(month) - 1;
  if (!year || !day || index < 0 || index > 11) return iso;
  return `${Number(day)} ${names[index]}`;
}

function tugas(book: LivestockBook, today: string): BarnNotice {
  const overdue = (book.scheduledTreatments ?? []).find((item) => effectiveCareStatus(item, today) === "OVERDUE");
  if (overdue) {
    return line("tugas-jadwal", "tugas", `${CARE_LABEL[overdue.kind]} ${overdue.earTag} terlambat. Selesaikan jadwalnya.`, "/livestock/treatments", true);
  }
  const due = (book.scheduledTreatments ?? []).find((item) => item.status === "PENDING" && item.scheduledOn === today);
  if (due) {
    return line("tugas-hari-ini", "tugas", `${CARE_LABEL[due.kind]} ${due.earTag} jatuh tempo hari ini.`, "/livestock/treatments", true);
  }
  const seen = new Set((book.inspections ?? []).filter((item) => item.inspectedOn === today).map((item) => item.penId));
  const pending = book.pens.filter((pen) => book.animals.some((animal) => animal.penId === pen.id && animal.health !== "terjual") && !seen.has(pen.id));
  const first = pending[0];
  if (first) {
    return line("tugas-inspeksi", "tugas", `Inspeksi ${shortPen(first.name)} belum diisi. Cek air dan pakan.`, "/kandang/inspeksi", true);
  }
  return line("tugas-selesai", "tugas", "Jadwal dan inspeksi hari ini sudah tercatat.", "/kandang/inspeksi", false);
}

function peringatan(book: LivestockBook, sales: AppData | null, today: string, nowIso: string, role: Role): BarnNotice {
  const live = book.animals.filter((animal) => animal.health !== "terjual");
  const sick = live.find((animal) => animal.health === "sakit");
  if (sick) {
    return line("peringatan-sakit", "peringatan", `${sick.earTag} sakit. Pisahkan dan cek suhu sekarang.`, "/livestock/health", true);
  }
  const quarantine = live.find((animal) => animal.health === "karantina");
  if (quarantine) {
    return line("peringatan-karantina", "peringatan", `${quarantine.earTag} karantina. Batasi kontak ternak lain.`, "/livestock/health", true);
  }
  for (const animal of live) {
    const doses = (book.treatmentCases ?? []).filter((item) => item.earTag === animal.earTag).flatMap((item) => item.doses);
    const hold = activeHolds(doses, nowIso)[0];
    if (hold) {
      return line("peringatan-henti", "peringatan", `Kohe ${animal.earTag} terkunci sampai ${shortDate(hold.until)}.`, "/reports/compliance", true);
    }
  }
  if (role === "SUPER_ADMIN" || role === "WAREHOUSE_ADMIN") {
    const stock = lowLine(sales);
    if (stock) {
      return line("peringatan-stok", "peringatan", `Stok ${stock.label} tinggal ${stock.qty} ${stock.unit}. Segera diisi.`, "/inventori", true);
    }
  }
  return line("peringatan-tenang", "peringatan", "Tidak ada ternak sakit atau stok di bawah batas.", "/reports/compliance", false);
}

function status(book: LivestockBook, today: string): BarnNotice {
  const saved = (book.inspections ?? []).filter((item) => item.inspectedOn === today);
  const latest = saved[0];
  if (latest) {
    const pen = book.pens.find((item) => item.id === latest.penId);
    const name = pen ? shortPen(pen.name) : "kandang";
    return line("status-inspeksi", "status", `Inspeksi ${name} masuk. Catatan shift sudah tersimpan.`, "/kandang/inspeksi", false);
  }
  const flagged = book.animals.filter((animal) => animal.health === "sakit" || animal.health === "karantina").length;
  if (flagged > 0) {
    return line("status-pantau", "status", `${flagged} ternak sakit atau karantina masih dipantau.`, "/reports/compliance", false);
  }
  return line("status-tenang", "status", "Kandang tenang. Lanjutkan pakan dan air biasa.", "/dashboard", false);
}

function lowLine(sales: AppData | null) {
  if (!sales) return null;
  const catalog = sales.products.length > 0 ? sales.products : PRODUCTS;
  const line = sales.stock
    .filter((item) => {
      const product = catalog.find((entry) => entry.id === item.variant);
      return product ? item.qty < lowStockLimit(product) : false;
    })
    .sort((left, right) => left.qty - right.qty)[0];
  if (!line) return null;
  const product = catalog.find((entry) => entry.id === line.variant);
  if (!product) return null;
  return { label: product.shortLabel, qty: line.qty, unit: product.unit };
}

/**
 * Three bell lines for the current barn: a task, an alert, and a status update.
 * Each line stays within 80 characters.
 */
export function barnNotices(input: {
  role: Role | null;
  book: LivestockBook | null;
  sales: AppData | null;
  today: string | null;
  nowIso: string | null;
}): BarnNotice[] {
  if (!input.role || !input.book || !input.today || !input.nowIso) return [];
  if (input.role === "FIELD_SALES") {
    return [
      line("tugas-lapangan", "tugas", "Cek pesanan terbuka sebelum menutup shift.", "/orders/fast", true),
      line("peringatan-lapangan", "peringatan", "Tidak ada alarm kandang untuk jalur lapangan.", "/orders/fast", false),
      line("status-lapangan", "status", "Pesanan dan mitra siap dicatat dari menu hilir.", "/mitra", false),
    ];
  }
  if (input.role === "WAREHOUSE_ADMIN") {
    const stock = lowLine(input.sales);
    return [
      line("tugas-gudang", "tugas", "Cek sak di bawah 20 dan jerigen di bawah 8.", "/inventori", Boolean(stock)),
      stock
        ? line("peringatan-stok", "peringatan", `Stok ${stock.label} tinggal ${stock.qty} ${stock.unit}. Segera diisi.`, "/inventori", true)
        : line("peringatan-stok-aman", "peringatan", "Stok kemasan masih di atas batas minimum.", "/inventori", false),
      line("status-gudang", "status", "Laporan stok gudang siap ditinjau.", "/inventori", false),
    ];
  }
  return [tugas(input.book, input.today), peringatan(input.book, input.sales, input.today, input.nowIso, input.role), status(input.book, input.today)];
}
