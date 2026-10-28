import type { Metadata } from "next";
import { LivestockView } from "@/components/kandang/livestock-view";

export const metadata: Metadata = {
  title: "Manajemen Kandang",
};

export default function KandangPage() {
  return <LivestockView />;
}
