import type { Metadata } from "next";
import { HealthView } from "@/components/kandang/health-view";

export const metadata: Metadata = {
  title: "Kesehatan Ternak",
};

export default function LivestockHealthPage() {
  return <HealthView />;
}
