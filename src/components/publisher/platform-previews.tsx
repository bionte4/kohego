"use client";

import { useAssetUrls } from "@/components/publisher/use-asset-urls";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatMediaSize, formatResolution, type MediaAttachment } from "@/lib/media";
import {
  PLATFORM_CAPABILITIES,
  PUBLISH_STATUS_LABEL,
  accountFor,
  clipCaption,
  previewFrames,
  type PreviewFrame,
  type PublishStatus,
  type SocialPlatform,
} from "@/lib/publisher";
import { cn } from "@/lib/utils";

const RATIO = {
  "4/5": "aspect-[4/5]",
  "9/16": "aspect-[9/16]",
  "1/1": "aspect-square",
} as const;

function tone(status: PublishStatus) {
  if (status === "terbit") return "forest" as const;
  if (status === "gagal") return "red" as const;
  if (status === "mengirim" || status === "terjadwal") return "amber" as const;
  return "slate" as const;
}

export function PlatformPreviews({
  caption,
  platforms,
  sending,
  media,
}: {
  caption: string;
  platforms: SocialPlatform[];
  sending: boolean;
  media: MediaAttachment[];
}) {
  const urls = useAssetUrls(media.map((item) => item.id));
  const selected = PLATFORM_CAPABILITIES.filter((item) => platforms.includes(item.platform));
  const status: PublishStatus = sending ? "mengirim" : "draf";

  return (
    <Card>
      <CardTitle>Pratinjau kanal</CardTitle>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        Bingkai mengikuti rasio unggahan. Foto dan naskah belum dikirim ke TikTok atau Meta.
      </p>
      {selected.length === 0 ? (
        <p className="text-sm text-slate-500">Pilih minimal satu platform.</p>
      ) : (
        <div className="space-y-5">
          {selected.map((capability) => {
            const account = accountFor(capability.platform);
            const text = clipCaption(caption, capability.maxCaption);
            return (
              <section key={capability.platform}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{capability.label}</h3>
                    <p className="text-xs text-slate-500">{account.handle}</p>
                  </div>
                  <Badge tone={tone(status)}>{PUBLISH_STATUS_LABEL[status]}</Badge>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {previewFrames(capability.platform).map((frame) => (
                    <li key={frame.id}>
                      <FrameCard frame={frame} caption={text} media={media} urls={urls} maxCaption={capability.maxCaption} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function FrameCard({
  frame,
  caption,
  media,
  urls,
  maxCaption,
}: {
  frame: PreviewFrame;
  caption: string;
  media: MediaAttachment[];
  urls: Record<string, string>;
  maxCaption: number;
}) {
  const photos = media.filter((item) => item.kind === "gambar");
  const cover =
    frame.mode === "video" || frame.mode === "reels"
      ? (media.find((item) => item.kind === "video") ?? media[0] ?? null)
      : (photos[0] ?? media[0] ?? null);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className={cn("relative bg-forest-950", frame.mode === "carousel" ? "aspect-[4/5]" : RATIO[frame.ratio])}>
        {frame.mode === "carousel" ? (
          <Carousel photos={photos} urls={urls} />
        ) : (
          <Stage asset={cover} url={cover ? urls[cover.id] : undefined} />
        )}
        {frame.mode === "reels" || frame.mode === "video" ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest-950/90 to-transparent p-3 pt-10">
            <p className="line-clamp-3 text-sm leading-5 text-white">{caption || "Naskah masih kosong."}</p>
          </div>
        ) : null}
      </div>
      {frame.mode === "feed" || frame.mode === "threads" ? (
        <p className="line-clamp-4 px-3 py-2 text-sm leading-6 text-ink">{caption || "Naskah masih kosong."}</p>
      ) : null}
      <p className="px-3 pb-3 text-xs text-slate-500">
        {frame.title}
        {cover && frame.mode !== "carousel"
          ? ` · ${formatResolution(cover.width, cover.height)} · ${formatMediaSize(cover.sizeBytes)}`
          : ""}
        {` · ${caption.length}/${maxCaption}`}
      </p>
    </article>
  );
}

function Stage({ asset, url }: { asset: MediaAttachment | null; url?: string }) {
  if (!asset || !url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-emerald-50/80">
        Belum ada foto atau video
      </div>
    );
  }
  if (asset.kind === "video") {
    return (
      <>
        <video src={url} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
        {asset.watermark ? (
          <span className="absolute inset-x-0 bottom-16 bg-forest-800/90 px-2 py-1 text-xs text-white">{asset.watermark}</span>
        ) : null}
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={asset.name} className="absolute inset-0 h-full w-full object-cover" />
  );
}

function Carousel({ photos, urls }: { photos: MediaAttachment[]; urls: Record<string, string> }) {
  if (photos.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-emerald-50/80">
        Belum ada foto untuk karusel
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex snap-x gap-2 overflow-x-auto p-3">
      {photos.map((photo, index) => (
        <figure key={photo.sourceId} className="relative aspect-[9/16] w-28 shrink-0 snap-start overflow-hidden rounded-xl bg-forest-900">
          {urls[photo.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[photo.id]} alt={photo.name} className="h-full w-full object-cover" />
          ) : null}
          <figcaption className="absolute bottom-1 left-1 rounded-full bg-forest-950/80 px-2 py-0.5 text-[10px] text-white">
            {index + 1}/{photos.length}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
