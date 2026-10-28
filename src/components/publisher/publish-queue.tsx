"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
  QUEUE_LABEL,
  historyStatusLabel,
  platformCapability,
  type PublishStatus,
  type QueueStatus,
  type SocialPost,
} from "@/lib/publisher";
import { cn } from "@/lib/utils";

function queueTone(status: QueueStatus) {
  if (status === "terbit") return "forest" as const;
  if (status === "terjadwal") return "amber" as const;
  return "slate" as const;
}

function targetTone(status: PublishStatus) {
  if (status === "terbit") return "forest" as const;
  if (status === "gagal") return "red" as const;
  if (status === "mengirim" || status === "terjadwal") return "amber" as const;
  return "slate" as const;
}

export function PublishQueue({
  posts,
  filter,
  onFilter,
  onDispatch,
  busyId,
}: {
  posts: SocialPost[];
  filter: QueueStatus | "all";
  onFilter: (filter: QueueStatus | "all") => void;
  onDispatch: (post: SocialPost) => void;
  busyId: string | null;
}) {
  const visible = posts.filter((post) => filter === "all" || post.queue === filter);

  return (
    <Card>
      <CardTitle>Riwayat kiriman</CardTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "Semua"],
            ["draf", "Draf"],
            ["terjadwal", "Terjadwal"],
            ["terbit", "Terbit"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => onFilter(id)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium",
              filter === id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada kiriman pada filter ini.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((post) => (
            <li key={post.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{post.listing.title}</p>
                  <p className="text-sm leading-6 text-slate-600">{post.caption}</p>
                </div>
                <Badge tone={queueTone(post.queue)}>{QUEUE_LABEL[post.queue]}</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {post.scheduledAt ? `Jadwal ${formatDateTime(post.scheduledAt)}` : "Tanpa jadwal"}
                {post.media.length > 0
                  ? ` · ${post.media.length} berkas${post.media.some((item) => item.watermark) ? ` · cap ${post.media.find((item) => item.watermark)?.watermark}` : ""}`
                  : ""}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {post.platforms.map((platform) => {
                  const target = post.targets.find((item) => item.platform === platform);
                  const status = target?.status ?? "draf";
                  return (
                    <li key={platform}>
                      <Badge tone={targetTone(status)}>
                        {platformCapability(platform).label} · {historyStatusLabel(status)}
                        {target?.externalId ? ` · ${target.externalId}` : ""}
                      </Badge>
                      {target?.error ? <p className="mt-1 text-xs text-red-700">{target.error}</p> : null}
                    </li>
                  );
                })}
              </ul>
              {post.queue !== "terbit" ? (
                <Button className="mt-3" disabled={busyId === post.id} onClick={() => onDispatch(post)}>
                  {busyId === post.id ? "Mengirim..." : "Kirim antrian"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
