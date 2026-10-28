import type { Metadata } from "next";
import { PublisherView } from "@/components/publisher/publisher-view";

export const metadata: Metadata = {
  title: "Publisher Sosmed",
};

export default function PemasaranPage() {
  return <PublisherView />;
}
