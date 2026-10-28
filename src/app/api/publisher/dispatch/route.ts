import { connection } from "next/server";
import { planDispatch, type SocialPlatform } from "@/lib/publisher";

const PLATFORMS: SocialPlatform[] = ["tiktok", "instagram", "facebook", "threads"];

export async function POST(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as {
    platforms?: unknown;
    caption?: unknown;
    hasImage?: unknown;
    hasVideo?: unknown;
  } | null;
  if (!body || !Array.isArray(body.platforms) || typeof body.caption !== "string") {
    return Response.json({ message: "Permintaan kiriman tidak valid." }, { status: 400 });
  }
  const platforms = body.platforms.filter((item): item is SocialPlatform => PLATFORMS.includes(item as SocialPlatform));
  if (platforms.length === 0) return Response.json({ message: "Pilih minimal satu platform." }, { status: 400 });
  if (!body.caption.trim()) return Response.json({ message: "Naskah masih kosong." }, { status: 400 });
  const targets = planDispatch(
    {
      platforms,
      caption: body.caption.trim(),
      hasImage: body.hasImage === true,
      hasVideo: body.hasVideo === true,
    },
    new Date().toISOString(),
  );
  return Response.json({ targets });
}
