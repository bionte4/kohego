import type { Metadata } from "next";
import { LineageView } from "@/components/kandang/lineage-view";

export const metadata: Metadata = { title: "Silsilah ternak" };

export default function LineagePage() {
  return <LineageView />;
}
