import { connection } from "next/server";
import { compostBalance } from "@/lib/compost";
import { persistCompost } from "@/lib/enterprise-db";
import { authorize } from "@/lib/session";

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("production", "create");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    carbonPercent?: unknown;
    nitrogenPercent?: unknown;
    rawKg?: unknown;
    lossPercent?: unknown;
    readings?: { day?: unknown; celsius?: unknown }[];
  } | null;
  if (!body || typeof body.id !== "string") return Response.json({ message: "Perhitungan kompos tidak valid." }, { status: 400 });
  const readings = Array.isArray(body.readings)
    ? body.readings.flatMap((item) => (typeof item.day === "number" && typeof item.celsius === "number" ? [{ day: item.day, celsius: item.celsius }] : []))
    : [];
  const result = compostBalance({
    carbonPercent: Number(body.carbonPercent),
    nitrogenPercent: Number(body.nitrogenPercent),
    rawKg: Number(body.rawKg),
    lossPercent: Number(body.lossPercent),
    readings,
  });
  if (!result.ok) return Response.json({ message: result.message }, { status: 400 });
  const saved = await persistCompost(body.id, result.value);
  return Response.json({ ok: true, stored: saved.stored, value: result.value });
}
