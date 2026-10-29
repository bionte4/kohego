import type { Metadata } from "next";
import { TreatmentSchedule } from "@/components/kandang/treatment-schedule";

export const metadata: Metadata = {
  title: "Jadwal Pengobatan",
};

export default function LivestockTreatmentsPage() {
  return <TreatmentSchedule />;
}
