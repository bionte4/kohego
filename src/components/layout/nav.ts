import {
  BarChart3,
  CircleUser,
  ClipboardList,
  HeartPulse,
  Syringe,
  Home,
  KeyRound,
  LayoutDashboard,
  Share2,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/rbac";

export type NavGroupId = "operasi" | "distribusi" | "laporan" | "relasi" | "pemasaran" | "pengaturan";

export interface NavGroup {
  id: NavGroupId;
  label: string;
}

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  group: NavGroupId;
  mobile: boolean;
  /** Roles that see this link. Super admin always sees the full menu. */
  roles: readonly Role[];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "operasi", label: "Operasi" },
  { id: "distribusi", label: "Distribusi" },
  { id: "laporan", label: "Laporan" },
  { id: "relasi", label: "Relasi" },
  { id: "pemasaran", label: "Pemasaran" },
  { id: "pengaturan", label: "Pengaturan" },
];

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dasbor",
    shortLabel: "Dasbor",
    title: "Dasbor",
    subtitle: "Pendapatan, tonase, dan komposisi produk",
    icon: LayoutDashboard,
    group: "operasi",
    mobile: false,
    roles: ["FARM_MANAGER", "WAREHOUSE_ADMIN", "FIELD_SALES"],
  },
  {
    href: "/orders/fast",
    label: "Pesanan cepat",
    shortLabel: "Pesanan",
    title: "Pesanan Cepat",
    subtitle: "Toko tani, perkebunan, dan urban farmer",
    icon: ClipboardList,
    group: "operasi",
    mobile: true,
    roles: ["FIELD_SALES"],
  },
  {
    href: "/inventori",
    label: "Inventori",
    shortLabel: "Stok",
    title: "Inventori",
    subtitle: "Kambing, sapi, ayam, POC, dan pergerakan gudang",
    icon: Warehouse,
    group: "distribusi",
    mobile: true,
    roles: ["FARM_MANAGER", "WAREHOUSE_ADMIN", "FIELD_SALES"],
  },
  {
    href: "/reports/financial",
    label: "Laporan keuangan",
    shortLabel: "Laporan",
    title: "Laporan Keuangan",
    subtitle: "Pendapatan, tonase, dan piutang konsinyasi",
    icon: BarChart3,
    group: "laporan",
    mobile: false,
    roles: ["FARM_MANAGER", "WAREHOUSE_ADMIN", "FIELD_SALES"],
  },
  {
    href: "/mitra",
    label: "Mitra",
    shortLabel: "Mitra",
    title: "Direktori Mitra",
    subtitle: "Kontak, tenor, dan riwayat pembelian",
    icon: Users,
    group: "relasi",
    mobile: true,
    roles: ["FIELD_SALES"],
  },
  {
    href: "/profil",
    label: "Profil",
    shortLabel: "Profil",
    title: "Profil Agen",
    subtitle: "Identitas lapangan dan wilayah kerja",
    icon: CircleUser,
    group: "relasi",
    mobile: true,
    roles: ["FARM_MANAGER", "WAREHOUSE_ADMIN", "FIELD_SALES"],
  },
  {
    href: "/kandang",
    label: "Manajemen Kandang",
    shortLabel: "Kandang",
    title: "Manajemen Kandang",
    subtitle: "Ternak hidup, kesehatan, dan kohe untuk pupuk",
    icon: Home,
    group: "operasi",
    mobile: false,
    roles: ["FARM_MANAGER", "WAREHOUSE_ADMIN"],
  },
  {
    href: "/livestock/health",
    label: "Kesehatan ternak",
    shortLabel: "Sehat",
    title: "Kesehatan Ternak",
    subtitle: "Suhu, aktivitas, dan ternak yang perlu perhatian",
    icon: HeartPulse,
    group: "operasi",
    mobile: false,
    roles: ["FARM_MANAGER", "WAREHOUSE_ADMIN"],
  },
  {
    href: "/livestock/treatments",
    label: "Jadwal pengobatan",
    shortLabel: "Jadwal",
    title: "Jadwal Pengobatan",
    subtitle: "Vaksin, obat cacing, vitamin, dan perawatan yang jatuh tempo",
    icon: Syringe,
    group: "operasi",
    mobile: false,
    roles: ["FARM_MANAGER", "WAREHOUSE_ADMIN"],
  },
  {
    href: "/publisher",
    label: "Publisher Sosmed",
    shortLabel: "Publisher",
    title: "Dasbor Publisher",
    subtitle: "Naskah, media, dan status kirim ke TikTok, Instagram, Facebook, dan Threads",
    icon: Share2,
    group: "pemasaran",
    mobile: false,
    roles: [],
  },
  {
    href: "/pemasaran/akun",
    label: "Akun Sosmed",
    shortLabel: "Akun",
    title: "Akun Sosmed",
    subtitle: "Status sambungan Instagram, Facebook, dan TikTok",
    icon: KeyRound,
    group: "pemasaran",
    mobile: false,
    roles: [],
  },
  {
    href: "/settings/users",
    label: "Pengguna",
    shortLabel: "Pengguna",
    title: "Pengguna",
    subtitle: "Nama, email, peran, dan status staf",
    icon: UserCog,
    group: "pengaturan",
    mobile: false,
    roles: [],
  },
];

/** Super admin, and the first paint before a role is known, keep the full menu. */
export function navItemsFor(role: Role | null) {
  if (!role || role === "SUPER_ADMIN") return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const MOBILE_NAV = NAV_ITEMS.filter((item) => item.mobile);

/** Sidebar modules that stay off the field bottom bar. */
export const MODULE_NAV = NAV_ITEMS.filter((item) => !item.mobile && item.href !== "/");

export function mobileNav(role: Role | null) {
  return navItemsFor(role).filter((item) => item.mobile);
}

export function moduleNav(role: Role | null) {
  return navItemsFor(role).filter((item) => !item.mobile && item.href !== "/");
}

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) return false;
  const moreSpecific = NAV_ITEMS.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(`${href}/`) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  return !moreSpecific;
}
