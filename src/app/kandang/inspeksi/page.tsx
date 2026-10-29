import type { Metadata } from "next";
import { InspectionView } from "@/components/kandang/inspection-view";

export const metadata: Metadata = {
  title: "Inspeksi Harian",
};

export default function InspectionPage() {
  return <InspectionView />;
}
