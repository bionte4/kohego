"use client";

import { useEffect, useState } from "react";
import { getAsset } from "@/lib/media-store";

export function useAssetUrls(ids: string[]) {
  const key = ids.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const created: string[] = [];
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const id of key ? key.split("|") : []) {
        const record = await getAsset(id);
        if (!record || cancelled) continue;
        const url = URL.createObjectURL(record.blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          continue;
        }
        created.push(url);
        next[id] = url;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [key]);

  return urls;
}
