import type { Metadata } from "next";
import { PayrollView } from "@/components/reports/payroll-view";

export const metadata: Metadata = {
  title: "Penggajian",
};

export default function PayrollPage() {
  return <PayrollView />;
}
