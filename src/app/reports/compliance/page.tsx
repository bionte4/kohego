import type { Metadata } from "next";
import { ComplianceView } from "@/components/reports/compliance-view";

export const metadata: Metadata = {
  title: "Kepatuhan",
};

export default function CompliancePage() {
  return <ComplianceView />;
}
