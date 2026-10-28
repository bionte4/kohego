import type { Metadata } from "next";
import { Suspense } from "react";
import { PartnerDirectory } from "@/components/partners/partner-directory";

export const metadata: Metadata = {
  title: "Direktori Mitra",
};

export default function PartnersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Memuat direktori mitra...</p>}>
      <PartnerDirectory />
    </Suspense>
  );
}
