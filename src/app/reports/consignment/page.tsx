import type { Metadata } from "next";
import { ConsignmentView } from "@/components/reports/consignment-view";

export const metadata: Metadata = { title: "Konsinyasi" };

export default function ConsignmentPage() {
  return <ConsignmentView />;
}