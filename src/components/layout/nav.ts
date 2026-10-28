import {
  CircleUser,
  ClipboardList,
  Home,
  KeyRound,
  LayoutDashboard,
  Share2,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type NavGroupId = "operasi" | "distribusi" | "relasi" | "pemasaran" | "pengaturan";

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
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "operasi", label: "Operasi" },
  { id: "distribusi", label: "Distribusi" },
  { id: "relasi", label: "Relasi" },
  { id: "pemasaran", label: "Pemasaran" },
  { id: "pengaturan", label: "Pengaturan" },
];

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dasbor",
    shortLabel: "Dasbor",
    title: "Dasbor",
    subtitle: "Pendapatan, tonase, dan komposisi produk",
    icon: LayoutDashboard,
    group: "operasi",
    mobile: false,
  },
  {
    href: "/penjualan",
    label: "Pesanan cepat",
    shortLabel: "Pesanan",
    title: "Pesanan Cepat",
    subtitle: "Toko tani, perkebunan, dan urban farmer",
    icon: ClipboardList,
    group: "operasi",
    mobile: true,
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
  },
];

export const MOBILE_NAV = NAV_ITEMS.filter((item) => item.mobile);

/** Sidebar modules that stay off the field bottom bar. */
export const MODULE_NAV = NAV_ITEMS.filter((item) => !item.mobile && item.href !== "/");

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
