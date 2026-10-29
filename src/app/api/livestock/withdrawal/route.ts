import { connection } from "next/server";
import { persistVeterinaryRules, persistWithdrawal } from "@/lib/enterprise-db";
import { authorize } from "@/lib/session";

export async function GET() {
  await connection();
  const gate = await authorize("livestock", "read");
  if (!gate.ok) return gate.response;
  const saved = await persistVeterinaryRules();
  return Response.json({ ok: true, stored: saved.stored });
}

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("livestock", "update");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as { id?: unknown; earTag?: unknown; medicineName?: unknown; startedAt?: unknown; untilOn?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.earTag !== "string" || typeof body.medicineName !== "string" || typeof body.startedAt !== "string" || typeof body.untilOn !== "string") {
    return Response.json({ message: "Periode henti obat tidak valid." }, { status: 400 });
  }
  const saved = await persistWithdrawal({ id: body.id, earTag: body.earTag, medicineName: body.medicineName, startedAt: body.startedAt, untilOn: body.untilOn });
  return Response.json({ ok: true, stored: saved.stored });
}
