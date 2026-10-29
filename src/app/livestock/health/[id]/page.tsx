import type { Metadata } from "next";
import { TreatmentDetail } from "@/components/kandang/treatment-detail";

export const metadata: Metadata = {
  title: "Protokol Pengobatan",
};

export default async function LivestockTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TreatmentDetail animalId={id} />;
}
