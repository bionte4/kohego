"use client";

import { Cloud, Images, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAssetUrls } from "@/components/publisher/use-asset-urls";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import {
  MAX_MEDIA_COUNT,
  formatDuration,
  formatMediaSize,
  formatResolution,
  watermarkLabel,
  type MediaAttachment,
  type WatermarkKind,
} from "@/lib/media";
import { attachCloudUrl, attachLocalFile, attachStored, listOriginals, restamp } from "@/lib/media-store";
import { cn } from "@/lib/utils";

export function MediaPicker({
  assets,
  earTag,
  contact,
  watermarkOn,
  watermarkKind,
  onAssets,
  onWatermark,
}: {
  assets: MediaAttachment[];
  earTag: string | null;
  contact: string;
  watermarkOn: boolean;
  watermarkKind: WatermarkKind;
  onAssets: (assets: MediaAttachment[]) => void;
  onWatermark: (on: boolean, kind: WatermarkKind) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudUrl, setCloudUrl] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archive, setArchive] = useState<MediaAttachment[]>([]);
  const urls = useAssetUrls([...new Set([...assets.map((item) => item.id), ...archive.map((item) => item.id)])]);
  const label = watermarkLabel(watermarkOn, watermarkKind, earTag, contact);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Berkas tidak dapat ditambahkan.");
    } finally {
      setBusy(false);
    }
  }

  function roomFor(count: number) {
    if (assets.length + count > MAX_MEDIA_COUNT) {
      setError(`Maksimal ${MAX_MEDIA_COUNT} berkas untuk satu kiriman.`);
      return false;
    }
    return true;
  }

  return (
    <Card>
      <CardTitle>Foto dan video</CardTitle>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        Unggah dari perangkat, pilih arsip di browser ini, atau tempel tautan penyimpanan awan. Berkas tinggal di perangkat dan ikut draf.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            const chosen = [...(event.target.files ?? [])];
            event.target.value = "";
            if (chosen.length === 0) return;
            if (!roomFor(chosen.length)) return;
            void run(async () => {
              const added: MediaAttachment[] = [];
              for (const file of chosen) added.push(await attachLocalFile(file, label));
              onAssets([...assets, ...added]);
            });
          }}
        />
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Unggah dari perangkat
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          aria-pressed={archiveOpen}
          onClick={() => {
            if (archiveOpen) {
              setArchiveOpen(false);
              return;
            }
            void run(async () => {
              const rows = await listOriginals();
              setArchive(
                rows.map((row) => ({
                  id: row.id,
                  sourceId: row.id,
                  name: row.name,
                  kind: row.kind,
                  mime: row.mime,
                  sizeBytes: row.sizeBytes,
                  width: row.width,
                  height: row.height,
                  durationSec: row.durationSec,
                  origin: "arsip",
                  watermark: null,
                })),
              );
              setArchiveOpen(true);
            });
          }}
        >
          <Images className="size-4" aria-hidden />
          Arsip perangkat
        </Button>
        <Button type="button" variant="secondary" aria-pressed={cloudOpen} onClick={() => setCloudOpen((open) => !open)}>
          <Cloud className="size-4" aria-hidden />
          Tautan awan
        </Button>
      </div>

      {cloudOpen ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!cloudUrl.trim()) {
              setError("Tempel tautan foto atau video.");
              return;
            }
            if (!roomFor(1)) return;
            const url = cloudUrl.trim();
            void run(async () => {
              const added = await attachCloudUrl(url, label);
              onAssets([...assets, added]);
              setCloudUrl("");
            });
          }}
        >
          <TextInput
            value={cloudUrl}
            onChange={(event) => setCloudUrl(event.target.value)}
            placeholder="https://..."
            inputMode="url"
            aria-label="Tautan berkas awan"
          />
          <Button type="submit" variant="secondary" disabled={busy}>
            Ambil
          </Button>
        </form>
      ) : null}

      {archiveOpen ? (
        <ul className="mt-3 grid gap-2">
          {archive.length === 0 ? (
            <li className="text-sm text-slate-500">Arsip masih kosong. Unggahan berikutnya tersimpan di sini.</li>
          ) : (
            archive.map((item) => {
              const selected = assets.some((asset) => asset.sourceId === item.id);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-2">
                  <Thumb url={urls[item.id]} name={item.name} kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatMediaSize(item.sizeBytes)} · {formatResolution(item.width, item.height)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || selected}
                    onClick={() => {
                      if (!roomFor(1)) return;
                      void run(async () => {
                        const added = await attachStored(item.id, label);
                        onAssets([...assets, added]);
                      });
                    }}
                  >
                    {selected ? "Terpilih" : "Pilih"}
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-ink">Cap pada foto</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <CapButton
            pressed={!watermarkOn}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                onAssets(await restamp(assets, null));
                onWatermark(false, watermarkKind);
              })
            }
          >
            Tanpa cap
          </CapButton>
          <CapButton
            pressed={watermarkOn && watermarkKind === "telinga"}
            disabled={busy || !earTag}
            onClick={() =>
              void run(async () => {
                const next = watermarkLabel(true, "telinga", earTag, contact);
                onAssets(await restamp(assets, next));
                onWatermark(true, "telinga");
              })
            }
          >
            Tanda telinga
          </CapButton>
          <CapButton
            pressed={watermarkOn && watermarkKind === "kontak"}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const next = watermarkLabel(true, "kontak", earTag, contact);
                onAssets(await restamp(assets, next));
                onWatermark(true, "kontak");
              })
            }
          >
            Kontak kandang
          </CapButton>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {earTag
            ? `Cap telinga memakai #${earTag}. Kontak memakai ${contact}.`
            : "Pilih ternak untuk memakai nomor telinga. Kontak memakai profil agen."}{" "}
          Cap dibakar ke foto. Pada video, cap tampil di pratinjau.
        </p>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {assets.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Belum ada foto atau video terpilih.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {assets.map((asset) => (
            <li key={asset.sourceId} className="overflow-hidden rounded-2xl border border-slate-200 bg-paper">
              <div className="relative aspect-[4/5] bg-forest-950">
                <Thumb url={urls[asset.id]} name={asset.name} kind={asset.kind} cover />
                {asset.kind === "video" && asset.watermark ? (
                  <span className="absolute inset-x-0 bottom-0 bg-forest-800/90 px-2 py-1 text-xs text-white">{asset.watermark}</span>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-medium">{asset.name}</p>
                <p className="text-xs leading-5 text-slate-600">
                  {formatMediaSize(asset.sizeBytes)} · {formatResolution(asset.width, asset.height)}
                  {asset.durationSec != null ? ` · ${formatDuration(asset.durationSec)}` : ""}
                </p>
                {asset.watermark ? <p className="text-xs text-forest-800">Cap {asset.watermark}</p> : null}
                <button
                  type="button"
                  className="min-h-11 text-sm font-medium text-earth-800"
                  onClick={() => onAssets(assets.filter((item) => item.sourceId !== asset.sourceId))}
                >
                  Lepas
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CapButton({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        pressed ? "border-forest-800 bg-forest-50 text-forest-900" : "border-slate-300 bg-white text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Thumb({
  url,
  name,
  kind = "gambar",
  cover = false,
}: {
  url?: string;
  name: string;
  kind?: "gambar" | "video";
  cover?: boolean;
}) {
  const frame = cover ? "absolute inset-0 h-full w-full object-cover" : "size-14 shrink-0 rounded-xl object-cover";
  if (!url) {
    return <div className={cover ? "absolute inset-0 bg-forest-900/50" : "size-14 shrink-0 rounded-xl bg-forest-50"} />;
  }
  if (kind === "video") {
    return <video src={url} className={frame} muted playsInline />;
  }
  return (
    // Blob previews are created on this device and are not next/image sources.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={frame} />
  );
}
