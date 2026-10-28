export type MediaKind = "gambar" | "video";

/** Where the file entered the publisher. Arsip is the on-device library. */
export type MediaOrigin = "perangkat" | "arsip" | "awan";

export type WatermarkKind = "telinga" | "kontak";

/** Metadata saved with a post. The bytes live in IndexedDB, not in this object. */
export interface MediaAttachment {
  id: string;
  sourceId: string;
  name: string;
  kind: MediaKind;
  mime: string;
  /** Bytes of the file that will be published. */
  sizeBytes: number;
  width: number;
  height: number;
  durationSec: number | null;
  origin: MediaOrigin;
  /** Burned label for a photo, or the preview label for a video. Null when the cap is off. */
  watermark: string | null;
}

export const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
export const MAX_MEDIA_COUNT = 8;

export function formatMediaSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(bytes / 1024)} KB`;
  }
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export function formatResolution(width: number, height: number) {
  return `${width} × ${height}`;
}

export function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

export function watermarkLabel(
  enabled: boolean,
  kind: WatermarkKind,
  earTag: string | null,
  contact: string,
) {
  if (!enabled) return null;
  if (kind === "telinga") return earTag ? `#${earTag}` : null;
  return contact;
}
