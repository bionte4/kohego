import { Suspense } from "react";
import type { Metadata } from "next";
import { TreatmentDetail } from "@/components/kandang/treatment-detail";

export const metadata: Metadata = {
  title: "Protokol Pengobatan",
};

export default function LivestockTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Menyiapkan protokol pengobatan...</p>}>
      <ResolvedTreatment params={params} />
    </Suspense>
  );
}

async function ResolvedTreatment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TreatmentDetail animalId={id} />;
}
