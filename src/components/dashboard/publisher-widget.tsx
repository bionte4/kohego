"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { getPublisherClient, getPublisherServer, subscribePublisher } from "@/lib/publisher-store";
import { publisherPulse } from "@/lib/role-dashboard";

export function PublisherWidget() {
  const book = useSyncExternalStore(subscribePublisher, getPublisherClient, getPublisherServer);
  if (!book) return null;
  const pulse = publisherPulse(book);
  const cells = [
    { label: "Menunggu", value: pulse.menunggu, className: "bg-amber-50 text-amber-950" },
    { label: "Terbit", value: pulse.terbit, className: "bg-forest-50 text-forest-950" },
    { label: "Gagal", value: pulse.gagal, className: "bg-earth-100 text-earth-900" },
  ];
  return (
    <Card>
      <CardTitle
        action={
          <Link href="/publisher" className="text-sm font-medium text-forest-800">
            Publisher
          </Link>
        }
      >
        Status kanal
      </CardTitle>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((cell) => (
          <div key={cell.label} className={`rounded-xl px-3 py-3 ${cell.className}`}>
            <p className="text-xs">{cell.label}</p>
            <p className="mt-1 font-display text-2xl">{cell.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-600">{pulse.posts} kiriman di antrian perangkat. Angka ini simulasi, bukan unggahan langsung ke TikTok atau Meta.</p>
    </Card>
  );
}
