import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dasbor",
};

export default function HomePage() {
  return <DashboardView />;
}
