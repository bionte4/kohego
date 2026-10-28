import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { finishOAuth, readPlatform } from "@/lib/social/oauth";

export async function GET(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  await connection();
  const { platform: raw } = await context.params;
  const platform = readPlatform(raw);
  if (!platform) return Response.json({ message: "Platform tidak dikenal." }, { status: 404 });
  return finishOAuth(platform, request);
}
