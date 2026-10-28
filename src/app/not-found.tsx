import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-3xl text-ink">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-slate-500">Alamat ini tidak ada di Kohego.</p>
      <Link href="/" className={buttonClass("primary", "mt-6")}>
        Kembali ke dasbor
      </Link>
    </div>
  );
}
