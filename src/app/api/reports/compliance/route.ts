import { connection } from "next/server";
import { COMPOST_STANDARD } from "@/lib/compost";
import { persistPharmacologyStandards } from "@/lib/enterprise-db";
import { PHARMACOLOGY_STANDARDS } from "@/lib/pharmacology-standards";
import { authorize } from "@/lib/session";

export async function GET() {
  await connection();
  const gate = await authorize("livestock", "read");
  if (!gate.ok) return gate.response;
  const saved = await persistPharmacologyStandards();
  return Response.json({ ok: true, stored: saved.stored, standards: PHARMACOLOGY_STANDARDS, compost: COMPOST_STANDARD });
}
