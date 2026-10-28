import type { Metadata } from "next";
import { FinancialReportView } from "@/components/reports/financial-report";

export const metadata: Metadata = {
  title: "Laporan Keuangan",
};

export default function FinancialReportPage() {
  return <FinancialReportView />;
}
