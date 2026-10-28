import type { Metadata } from "next";
import { PublisherView } from "@/components/publisher/publisher-view";

export const metadata: Metadata = {
  title: "Dasbor Publisher",
};

export default function PublisherPage() {
  return <PublisherView />;
}
