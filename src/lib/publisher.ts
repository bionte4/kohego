import { formatIdr } from "@/lib/format";
import type { MediaAttachment } from "@/lib/media";

export type SocialPlatform = "tiktok" | "instagram" | "facebook" | "threads";

/** Queue column for the publisher board. Per-platform receipts use PublishStatus. */
export type QueueStatus = "draf" | "terjadwal" | "terbit";

export type PublishStatus = "draf" | "terjadwal" | "mengirim" | "terbit" | "gagal";

export type ListingKind = "produk" | "ternak";

export interface PlatformCapability {
  platform: SocialPlatform;
  label: string;
  allowsImage: boolean;
  allowsVideo: boolean;
  allowsTextOnly: boolean;
  maxCaption: number;
}

export interface PreviewFrame {
  id: string;
  title: string;
  ratio: "4/5" | "9/16" | "1/1";
  mode: "feed" | "reels" | "video" | "carousel" | "threads";
}

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  handle: string;
  connected: boolean;
}

export interface ListingRef {
  kind: ListingKind;
  refId: string;
  title: string;
}

export interface PublishTarget {
  platform: SocialPlatform;
  accountId: string;
  status: PublishStatus;
  /** Receipt id from the mock channel queue. Not a live platform id. */
  externalId: string | null;
  error: string | null;
  publishedAt: string | null;
}

export interface SocialPost {
  id: string;
  listing: ListingRef;
  caption: string;
  platforms: SocialPlatform[];
  /** Photos and video chosen for this post. Bytes stay in the device archive. */
  media: MediaAttachment[];
  queue: QueueStatus;
  scheduledAt: string | null;
  createdAt: string;
  targets: PublishTarget[];
}

export interface PublisherBook {
  version: 1;
  posts: SocialPost[];
}

/** Facts copied from inventory or the herd at the moment the caption is written. */
export interface CaptionSubject {
  key: string;
  kind: ListingKind;
  refId: string;
  title: string;
  packaging: string;
  priceIdr: number | null;
  unitLabel: string | null;
  /** On-hand packages. Null for a live animal. */
  availableQty: number | null;
  pitch: string;
  /** Set for a live animal so a photo can be stamped with the ear tag. */
  earTag: string | null;
}

export const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  { platform: "tiktok", label: "TikTok", allowsImage: true, allowsVideo: true, allowsTextOnly: false, maxCaption: 2200 },
  { platform: "instagram", label: "Instagram", allowsImage: true, allowsVideo: true, allowsTextOnly: false, maxCaption: 2200 },
  { platform: "facebook", label: "Facebook", allowsImage: true, allowsVideo: true, allowsTextOnly: true, maxCaption: 5000 },
  { platform: "threads", label: "Threads", allowsImage: true, allowsVideo: true, allowsTextOnly: true, maxCaption: 500 },
];

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  { id: "acc-tt", platform: "tiktok", handle: "@kohego.id", connected: true },
  { id: "acc-ig", platform: "instagram", handle: "@kohego.id", connected: true },
  { id: "acc-fb", platform: "facebook", handle: "Kohego Pupuk Organik", connected: true },
  { id: "acc-th", platform: "threads", handle: "@kohego.id", connected: true },
];

export const QUEUE_LABEL: Record<QueueStatus, string> = {
  draf: "Draf",
  terjadwal: "Terjadwal",
  terbit: "Terbit",
};

export const PUBLISH_STATUS_LABEL: Record<PublishStatus, string> = {
  draf: "Draf",
  terjadwal: "Terjadwal",
  mengirim: "Mengirim",
  terbit: "Terbit",
  gagal: "Gagal",
};

export function platformCapability(platform: SocialPlatform) {
  const capability = PLATFORM_CAPABILITIES.find((item) => item.platform === platform);
  if (!capability) throw new Error(`Platform tidak dikenal: ${platform}`);
  return capability;
}

export function accountFor(platform: SocialPlatform) {
  const account = SOCIAL_ACCOUNTS.find((item) => item.platform === platform);
  if (!account) throw new Error(`Akun tidak dikenal: ${platform}`);
  return account;
}

/**
 * Marketing line built only from the subject facts.
 * A package count under 20 is called out as limited stock. That threshold is a caption rule,
 * separate from the warehouse reorder point, so a jerigen and a sak read the same way in a post.
 */
export function composeCaption(subject: CaptionSubject) {
  if (subject.kind === "ternak") {
    return `${subject.title}. ${subject.packaging}. ${subject.pitch}`.replace(/\s+/g, " ").trim();
  }
  const price =
    subject.priceIdr != null && subject.unitLabel
      ? `${formatIdr(subject.priceIdr)} / ${subject.unitLabel}`
      : "";
  const qty = subject.availableQty ?? 0;
  const unit = subject.unitLabel ?? "kemasan";
  const stock =
    qty <= 0 ? "Stok kemasan sedang kosong." : qty < 20 ? `Tersisa ${qty} ${unit}.` : `Stok ${qty} ${unit}.`;
  return `${subject.title}, ${subject.packaging}. ${price}. ${stock} ${subject.pitch}`.replace(/\s+/g, " ").trim();
}

export function previewFrames(platform: SocialPlatform): PreviewFrame[] {
  if (platform === "tiktok") {
    return [
      { id: "tiktok-video", title: "Video", ratio: "9/16", mode: "video" },
      { id: "tiktok-carousel", title: "Karusel foto", ratio: "9/16", mode: "carousel" },
    ];
  }
  if (platform === "threads") {
    return [{ id: "threads", title: "Utas", ratio: "1/1", mode: "threads" }];
  }
  return [
    { id: `${platform}-feed`, title: "Feed", ratio: "4/5", mode: "feed" },
    { id: `${platform}-reels`, title: "Reels", ratio: "9/16", mode: "reels" },
  ];
}

export function clipCaption(caption: string, max: number) {
  if (caption.length <= max) return caption;
  return `${caption.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function createPublisherSeed(): PublisherBook {
  return {
    version: 1,
    posts: [
      {
        id: "post-kambing-25",
        listing: { kind: "produk", refId: "kambing-25", title: "Kohe Kambing 25 kg" },
        caption: "Kohe Kambing 25 kg, kemasan curah. Siap untuk musim tanam.",
        platforms: ["tiktok", "instagram", "facebook"],
        media: [],
        queue: "terbit",
        scheduledAt: null,
        createdAt: "2026-10-26T03:00:00.000Z",
        targets: [
          { platform: "tiktok", accountId: "acc-tt", status: "terbit", externalId: "tt-88421", error: null, publishedAt: "2026-10-26T03:12:00.000Z" },
          { platform: "instagram", accountId: "acc-ig", status: "terbit", externalId: "ig-22910", error: null, publishedAt: "2026-10-26T03:14:00.000Z" },
          { platform: "facebook", accountId: "acc-fb", status: "terbit", externalId: "fb-11002", error: null, publishedAt: "2026-10-26T03:15:00.000Z" },
        ],
      },
      {
        id: "post-poc-draf",
        listing: { kind: "produk", refId: "poc-1", title: "POC 1 L" },
        caption: "POC 1 L untuk kebun kota. Encerkan sebelum disiram.",
        platforms: ["instagram", "threads"],
        media: [],
        queue: "draf",
        scheduledAt: null,
        createdAt: "2026-10-27T04:40:00.000Z",
        targets: [],
      },
    ],
  };
}

export function planDispatch(
  input: { platforms: SocialPlatform[]; caption: string; hasImage: boolean; hasVideo: boolean },
  nowIso: string,
): PublishTarget[] {
  const hasMedia = input.hasImage || input.hasVideo;
  return input.platforms.map((platform) => {
    const account = accountFor(platform);
    const capability = platformCapability(platform);
    if (!account.connected) {
      return { platform, accountId: account.id, status: "gagal", externalId: null, error: "Akun belum terhubung.", publishedAt: null };
    }
    if (!capability.allowsTextOnly && !hasMedia) {
      return {
        platform,
        accountId: account.id,
        status: "gagal",
        externalId: null,
        error: `${capability.label} butuh foto atau video.`,
        publishedAt: null,
      };
    }
    if (input.caption.length > capability.maxCaption) {
      return {
        platform,
        accountId: account.id,
        status: "gagal",
        externalId: null,
        error: `Naskah melebihi ${capability.maxCaption} karakter.`,
        publishedAt: null,
      };
    }
    return {
      platform,
      accountId: account.id,
      status: "terbit",
      externalId: `${platform.slice(0, 2)}-${nowIso.slice(11, 19).split(":").join("")}`,
      error: null,
      publishedAt: nowIso,
    };
  });
}

export function pendingTargets(post: SocialPost): SocialPost {
  return {
    ...post,
    targets: post.platforms.map((platform) => ({
      platform,
      accountId: accountFor(platform).id,
      status: "mengirim" as const,
      externalId: null,
      error: null,
      publishedAt: null,
    })),
  };
}

export function scheduledTargets(post: SocialPost): SocialPost {
  return {
    ...post,
    targets: post.platforms.map((platform) => ({
      platform,
      accountId: accountFor(platform).id,
      status: "terjadwal" as const,
      externalId: null,
      error: null,
      publishedAt: null,
    })),
  };
}

/** Menunggu covers in-flight and scheduled receipts. Terbit and Gagal are the finished outcomes. */
export function historyStatusLabel(status: PublishStatus) {
  if (status === "mengirim" || status === "terjadwal") return "Menunggu";
  if (status === "terbit") return "Terbit";
  if (status === "gagal") return "Gagal";
  return "Draf";
}

/**
 * Stand-in for TikTok and Meta. Resolves with a receipt per selected platform.
 * Nothing is sent off the device.
 */
export function enqueueDispatch(post: SocialPost, nowIso: string): Promise<SocialPost> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(markDispatched(post, nowIso)), 700);
  });
}

export function markDispatched(post: SocialPost, nowIso: string): SocialPost {
  const targets = planDispatch(
    {
      platforms: post.platforms,
      caption: post.caption,
      hasImage: post.media.some((item) => item.kind === "gambar"),
      hasVideo: post.media.some((item) => item.kind === "video"),
    },
    nowIso,
  );
  const anyLive = targets.some((target) => target.status === "terbit");
  return { ...post, queue: anyLive ? "terbit" : post.queue, targets };
}

export function savePost(book: PublisherBook, post: SocialPost): PublisherBook {
  const exists = book.posts.some((item) => item.id === post.id);
  return {
    ...book,
    posts: exists ? book.posts.map((item) => (item.id === post.id ? post : item)) : [post, ...book.posts],
  };
}
