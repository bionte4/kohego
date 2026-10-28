import { uid } from "@/lib/utils";
import {
  MAX_MEDIA_BYTES,
  type MediaAttachment,
  type MediaKind,
  type MediaOrigin,
} from "@/lib/media";

const DB_NAME = "kohego-media";
const STORE = "assets";

export interface StoredAsset {
  id: string;
  blob: Blob;
  name: string;
  mime: string;
  kind: MediaKind;
  sizeBytes: number;
  width: number;
  height: number;
  durationSec: number | null;
  origin: MediaOrigin;
  watermark: string | null;
  sourceId: string | null;
  createdAt: string;
}

let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>) {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Penyimpanan media tidak tersedia di browser ini."));
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("sourceId", "sourceId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Arsip media gagal dibuka."));
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Arsip media gagal ditulis."));
      }),
  );
}

export function putAsset(record: StoredAsset) {
  return run("readwrite", (store) => store.put(record));
}

export function getAsset(id: string) {
  return run<StoredAsset | undefined>("readonly", (store) => store.get(id));
}

export function listOriginals() {
  return run<StoredAsset[]>("readonly", (store) => store.getAll()).then((rows) =>
    rows.filter((row) => row.sourceId == null).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  );
}

async function deleteDerivatives(sourceId: string) {
  const rows = await run<StoredAsset[]>("readonly", (store) => store.getAll());
  const doomed = rows.filter((row) => row.sourceId === sourceId);
  await Promise.all(doomed.map((row) => run("readwrite", (store) => store.delete(row.id))));
}

function usableMime(name: string, type: string) {
  if (type && type !== "application/octet-stream") return type;
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "image/jpeg";
}

function classify(file: { type: string; name: string }): MediaKind {
  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) return "gambar";
  if (type.startsWith("video/")) return "video";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "gambar";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  throw new Error("Gunakan foto JPG, PNG, WEBP, atau video MP4.");
}

function assertSize(size: number) {
  if (size <= 0) throw new Error("Berkas kosong.");
  if (size > MAX_MEDIA_BYTES) throw new Error("Berkas melebihi 12 MB.");
}

async function measure(blob: Blob, kind: MediaKind) {
  if (kind === "gambar") {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height, durationSec: null as number | null };
    bitmap.close();
    if (!size.width || !size.height) throw new Error("Foto tidak dapat dibaca.");
    return size;
  }
  return measureVideo(blob);
}

function measureVideo(blob: Blob) {
  return new Promise<{ width: number; height: number; durationSec: number }>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const durationSec = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      URL.revokeObjectURL(url);
      if (!width || !height) {
        reject(new Error("Video tidak dapat dibaca."));
        return;
      }
      resolve({ width, height, durationSec });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video tidak dapat dibaca."));
    };
    video.src = url;
  });
}

/**
 * Draws a forest bar along the bottom of a still photo.
 * Bar height is 8% of the frame, with a 48px floor, so an ear tag stays readable
 * on a phone snap and on a large camera file. Video is not re-encoded here.
 */
export async function burnWatermark(blob: Blob, label: string) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Kanvas cap tidak tersedia.");
  }
  ctx.drawImage(bitmap, 0, 0);
  const bar = Math.max(48, Math.round(bitmap.height * 0.08));
  ctx.fillStyle = "rgba(22, 101, 52, 0.9)";
  ctx.fillRect(0, bitmap.height - bar, bitmap.width, bar);
  ctx.fillStyle = "#f9fafb";
  ctx.font = `600 ${Math.max(18, Math.round(bar * 0.42))}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, Math.round(bar * 0.35), bitmap.height - bar / 2, bitmap.width - bar);
  bitmap.close();
  const burned = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Cap gagal dibuat."))), "image/jpeg", 0.9);
  });
  return burned;
}

function toAttachment(record: StoredAsset, sourceId: string): MediaAttachment {
  return {
    id: record.id,
    sourceId,
    name: record.name,
    kind: record.kind,
    mime: record.mime,
    sizeBytes: record.sizeBytes,
    width: record.width,
    height: record.height,
    durationSec: record.durationSec,
    origin: record.origin,
    watermark: record.watermark,
  };
}

async function storeOriginal(blob: Blob, name: string, mimeType: string, origin: MediaOrigin) {
  assertSize(blob.size);
  const mime = usableMime(name, mimeType || blob.type);
  const kind = classify({ type: mime, name });
  const measured = await measure(blob, kind);
  const record: StoredAsset = {
    id: uid("media"),
    blob,
    name,
    mime,
    kind,
    sizeBytes: blob.size,
    width: measured.width,
    height: measured.height,
    durationSec: measured.durationSec,
    origin,
    watermark: null,
    sourceId: null,
    createdAt: new Date().toISOString(),
  };
  await putAsset(record);
  return toAttachment(record, record.id);
}

async function stampOne(asset: MediaAttachment, label: string | null): Promise<MediaAttachment> {
  await deleteDerivatives(asset.sourceId);
  if (!label || asset.kind !== "gambar") {
    return { ...asset, id: asset.sourceId, watermark: label };
  }
  const original = await getAsset(asset.sourceId);
  if (!original) throw new Error("Foto asli tidak ada di arsip.");
  const burned = await burnWatermark(original.blob, label);
  const record: StoredAsset = {
    id: uid("media"),
    blob: burned,
    name: original.name,
    mime: "image/jpeg",
    kind: "gambar",
    sizeBytes: burned.size,
    width: original.width,
    height: original.height,
    durationSec: null,
    origin: original.origin,
    watermark: label,
    sourceId: original.id,
    createdAt: new Date().toISOString(),
  };
  await putAsset(record);
  return toAttachment(record, original.id);
}

export function attachLocalFile(file: File, label: string | null) {
  return serialize(async () => {
    const original = await storeOriginal(file, file.name || "foto", file.type, "perangkat");
    return stampOne(original, label);
  });
}

export function attachStored(id: string, label: string | null) {
  return serialize(async () => {
    const record = await getAsset(id);
    if (!record || record.sourceId) throw new Error("Berkas arsip tidak ditemukan.");
    return stampOne(toAttachment(record, record.id), label);
  });
}

export function attachCloudUrl(raw: string, label: string | null) {
  return serialize(async () => {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw new Error("Tautan tidak valid.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Tautan harus http atau https.");
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error("Penyimpanan awan menolak berkas itu.");
    const blob = await response.blob();
    const name = decodeURIComponent(url.pathname.split("/").pop() || "awan");
    const original = await storeOriginal(blob, name, blob.type, "awan");
    return stampOne(original, label);
  });
}

export function restamp(assets: MediaAttachment[], label: string | null) {
  return serialize(async () => {
    const next: MediaAttachment[] = [];
    for (const asset of assets) next.push(await stampOne(asset, label));
    return next;
  });
}
