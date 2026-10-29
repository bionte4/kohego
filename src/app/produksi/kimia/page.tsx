import type { Metadata } from "next";
import { CompostView } from "@/components/kandang/compost-view";

export const metadata: Metadata = { title: "Kimia kompos" };

export default function CompostPage() {
  return <CompostView />;
}
