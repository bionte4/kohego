import type { Metadata } from "next";
import { SalesView } from "@/components/sales/sales-view";

export const metadata: Metadata = {
  title: "Pesanan Cepat",
};

export default function SalesPage() {
  return <SalesView />;
}
