"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CaptionFactory } from "@/components/publisher/caption-factory";
import { MediaPicker } from "@/components/publisher/media-picker";
import { PlatformPreviews } from "@/components/publisher/platform-previews";
import { PublishQueue } from "@/components/publisher/publish-queue";
import { useStoreState } from "@/components/providers/store-provider";
import { formatWeight } from "@/lib/format";
import { packageUnitLabel } from "@/lib/labels";
import { HEALTH_LABEL, SPECIES_LABEL, liveWeightKg, type Animal } from "@/lib/livestock";
import { watermarkLabel, type MediaAttachment, type WatermarkKind } from "@/lib/media";
import { restamp } from "@/lib/media-store";
import { getLivestockClient, getLivestockServer, subscribeLivestock } from "@/lib/livestock-store";
import {
  composeCaption,
  enqueueDispatch,
  pendingTargets,
  savePost,
  scheduledTargets,
  type CaptionSubject,
  type QueueStatus,
  type SocialPlatform,
  type SocialPost,
} from "@/lib/publisher";
import { getPublisherClient, getPublisherServer, replacePublisher, subscribePublisher } from "@/lib/publisher-store";
import type { StockLine, VariantId } from "@/lib/types";
import { uid } from "@/lib/utils";

const PITCH: Record<string, string> = {
  kambing: "Pupuk kandang fermentasi untuk kebun dan sawah.",
  sapi: "Soil conditioner untuk memperbaiki struktur tanah.",
  ayam: "Nitrogen booster untuk sayuran.",
  poc: "Pupuk organik cair. Encerkan sebelum disiram.",
};

function packagesOnHand(stock: StockLine[], variant: VariantId) {
  return stock.reduce((sum, line) => (line.variant === variant ? sum + line.qty : sum), 0);
}

function animalSubject(animal: Animal, penName: string): CaptionSubject {
  return {
    key: `ternak:${animal.id}`,
    kind: "ternak",
    refId: animal.id,
    title: `${SPECIES_LABEL[animal.species]} ${animal.breed} · ${animal.earTag}`,
    packaging: `${animal.headcount} ekor · ${formatWeight(liveWeightKg(animal))} hidup · ${penName}`,
    priceIdr: null,
    unitLabel: null,
    availableQty: null,
    pitch: `Kondisi ${HEALTH_LABEL[animal.health].toLowerCase()}.`,
    earTag: animal.earTag,
  };
}

export function PublisherView() {
  const sales = useStoreState();
  const herd = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const book = useSyncExternalStore(subscribePublisher, getPublisherClient, getPublisherServer);
  const [filter, setFilter] = useState<QueueStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjectKey, setSubjectKey] = useState("produk:kambing-25");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["tiktok", "instagram", "facebook", "threads"]);
  const [when, setWhen] = useState("");
  const [override, setOverride] = useState<string | null>(null);
  const [assets, setAssets] = useState<MediaAttachment[]>([]);
  const [watermarkOn, setWatermarkOn] = useState(false);
  const [watermarkKind, setWatermarkKind] = useState<WatermarkKind>("telinga");

  const subjects = useMemo(() => {
    if (!sales.ready) return [];
    const products: CaptionSubject[] = sales.products.map((product) => ({
      key: `produk:${product.id}`,
      kind: "produk",
      refId: product.id,
      title: product.label,
      packaging: `${product.role} · ${product.shortLabel}`,
      priceIdr: product.priceIdr,
      unitLabel: packageUnitLabel(product.unit),
      availableQty: packagesOnHand(sales.stock, product.id),
      pitch: PITCH[product.family] ?? "",
      earTag: null,
    }));
    const animals: CaptionSubject[] = (herd?.animals ?? []).map((animal) =>
      animalSubject(animal, herd?.pens.find((pen) => pen.id === animal.penId)?.name ?? "Kandang"),
    );
    return [...products, ...animals];
  }, [sales, herd]);

  const subject = subjects.find((item) => item.key === subjectKey) ?? subjects[0];
  const generated = subject ? composeCaption(subject) : "";
  const caption = override ?? generated;

  if (!sales.ready || !book || !subject) {
    return <p className="text-sm text-slate-500">Menyiapkan antrian publikasi...</p>;
  }

  function persist(post: SocialPost) {
    const current = getPublisherClient();
    if (!current) return "Data belum siap.";
    const saved = replacePublisher(savePost(current, post));
    return saved ? null : "Antrian tidak tersimpan. Penyimpanan browser penuh atau diblokir.";
  }

  function guard() {
    if (platforms.length === 0) return "Pilih minimal satu platform.";
    if (!caption.trim()) return "Naskah masih kosong.";
    return null;
  }

  function buildPost(queue: QueueStatus, scheduledAt: string | null): SocialPost {
    return {
      id: uid("post"),
      listing: { kind: subject.kind, refId: subject.refId, title: subject.title },
      caption: caption.trim(),
      platforms,
      media: assets,
      queue,
      scheduledAt,
      createdAt: new Date().toISOString(),
      targets: [],
    };
  }

  async function dispatch(post: SocialPost) {
    setBusyId(post.id);
    setNotice(null);
    const pending = pendingTargets(post);
    const held = persist(pending);
    if (held) {
      setBusyId(null);
      setError(held);
      return;
    }
    let next = pending;
    try {
      const response = await fetch("/api/publisher/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platforms: pending.platforms,
          caption: pending.caption,
          hasImage: pending.media.some((item) => item.kind === "gambar"),
          hasVideo: pending.media.some((item) => item.kind === "video"),
        }),
      });
      const body = (await response.json().catch(() => null)) as { targets?: SocialPost["targets"]; message?: string } | null;
      if (!response.ok || !body?.targets) throw new Error(body?.message ?? "Antrian server tidak menjawab.");
      const anyLive = body.targets.some((target) => target.status === "terbit");
      next = { ...pending, targets: body.targets, queue: anyLive ? "terbit" : pending.queue };
    } catch {
      next = await enqueueDispatch(pending, new Date().toISOString());
    }
    const problem = persist(next);
    setBusyId(null);
    setNotice(problem ?? `Kiriman ${next.listing.title} selesai diproses untuk ${next.targets.length} platform.`);
    setFilter("all");
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        Naskah mengambil nama, kemasan, harga, dan stok dari data di perangkat ini. Foto ternak dan kemasan disimpan di arsip browser. Tombol terbit menjalankan antrian lokal, bukan API TikTok atau Meta.
      </p>
      {notice ? <p className="text-sm font-medium text-forest-800">{notice}</p> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="space-y-4">
          <CaptionFactory
          subjects={subjects}
          subjectKey={subject.key}
          caption={caption}
          platforms={platforms}
          when={when}
          busy={busyId !== null}
          error={error}
          onSubject={(key) => {
            setSubjectKey(key);
            setOverride(null);
            setError(null);
            const next = subjects.find((item) => item.key === key);
            const contact = `${sales.profile.name} · ${sales.profile.phone}`;
            const keepEarTag = watermarkOn && watermarkKind === "telinga" && Boolean(next?.earTag);
            if (watermarkOn && watermarkKind === "telinga" && !next?.earTag) setWatermarkOn(false);
            const label = watermarkLabel(keepEarTag, watermarkKind, next?.earTag ?? null, contact);
            void restamp(assets, label)
              .then(setAssets)
              .catch(() => setError("Cap tidak dapat diperbarui."));
          }}
          onCaption={setOverride}
          onToggle={(platform) =>
            setPlatforms((current) =>
              current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform],
            )
          }
          onResetCaption={() => setOverride(null)}
          onWhen={setWhen}
          onSaveDraft={() => {
            const problem = guard();
            setError(problem);
            if (problem) return;
            const saved = persist(buildPost("draf", null));
            setError(saved);
            if (!saved) setNotice("Draf tersimpan.");
          }}
          onSchedule={() => {
            const problem = guard();
            if (problem || !when) {
              setError(problem ?? "Isi tanggal jadwal.");
              return;
            }
            const scheduledAt = new Date(when);
            if (Number.isNaN(scheduledAt.getTime())) {
              setError("Jadwal tidak valid.");
              return;
            }
            setError(null);
            const saved = persist(scheduledTargets(buildPost("terjadwal", scheduledAt.toISOString())));
            setError(saved);
            if (!saved) setNotice("Jadwal tersimpan.");
          }}
          onPublish={() => {
            const problem = guard();
            setError(problem);
            if (problem) return;
            void dispatch(buildPost("draf", null));
          }}
        />
          <MediaPicker
            assets={assets}
            earTag={subject.earTag}
            contact={`${sales.profile.name} · ${sales.profile.phone}`}
            watermarkOn={watermarkOn}
            watermarkKind={watermarkKind}
            onAssets={setAssets}
            onWatermark={(on, kind) => {
              setWatermarkOn(on);
              setWatermarkKind(kind);
            }}
          />
        </div>
        <PlatformPreviews caption={caption} platforms={platforms} sending={busyId !== null} media={assets} />
      </div>
      <PublishQueue
        posts={book.posts}
        filter={filter}
        onFilter={setFilter}
        onDispatch={(post) => void dispatch(post)}
        busyId={busyId}
      />
    </div>
  );
}
