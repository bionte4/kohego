import { connection } from "next/server";
import { persistRegistry } from "@/lib/enterprise-db";
import { isIcarRfid } from "@/lib/identification";
import { authorize } from "@/lib/session";

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("livestock", "update");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as { earTag?: unknown; rfid?: unknown } | null;
  if (!body || typeof body.earTag !== "string" || typeof body.rfid !== "string" || !isIcarRfid(body.rfid)) {
    return Response.json({ message: "RFID ICAR berisi 15 digit angka." }, { status: 400 });
  }
  const saved = await persistRegistry({ earTag: body.earTag, rfidTag: body.rfid });
  return Response.json({ ok: true, stored: saved.stored });
}
