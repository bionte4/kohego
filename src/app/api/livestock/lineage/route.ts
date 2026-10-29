import { connection } from "next/server";
import { persistLineage } from "@/lib/enterprise-db";
import { isLifeStage } from "@/lib/livestock";
import { authorize } from "@/lib/session";

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("livestock", "update");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as { id?: unknown; earTag?: unknown; sireTag?: unknown; damTag?: unknown; stage?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.earTag !== "string" || !isLifeStage(body.stage)) {
    return Response.json({ message: "Silsilah tidak valid." }, { status: 400 });
  }
  const saved = await persistLineage({
    id: body.id,
    earTag: body.earTag,
    sireTag: typeof body.sireTag === "string" ? body.sireTag : "",
    damTag: typeof body.damTag === "string" ? body.damTag : "",
    stage: body.stage,
  });
  return Response.json({ ok: true, stored: saved.stored });
}
