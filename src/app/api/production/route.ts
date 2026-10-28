import { conversionVariants, type LivestockSpecies } from "@/lib/livestock";
import { estimateProduction, packageMeasure } from "@/lib/production";
import { persistCompletedBatch } from "@/lib/production-db";
import { authorize } from "@/lib/session";
import type { VariantId } from "@/lib/types";

const SPECIES = ["sapi", "kambing", "ayam", "bebek"] as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    species?: string;
    rawKg?: number;
    conversionRate?: number;
    variantId?: string;
    id?: string;
  } | null;
  const gate = await authorize("production", body?.action === "complete" ? "create" : "read");
  if (!gate.ok) return gate.response;
  if (!body) return Response.json({ message: "Permintaan tidak valid." }, { status: 400 });
  const species = body.species as LivestockSpecies;
  const variantId = body.variantId as VariantId;
  if (!SPECIES.includes(species) || !variantId) {
    return Response.json({ message: "Jenis ternak atau varian tidak dikenal." }, { status: 400 });
  }
  if (!conversionVariants(species).includes(variantId)) {
    return Response.json({ message: "SKU itu tidak dibuat dari kohe ini." }, { status: 400 });
  }
  const measure = packageMeasure(variantId);
  if (!measure) return Response.json({ message: "Varian tidak dikenal." }, { status: 400 });
  const estimate = estimateProduction(Number(body.rawKg), Number(body.conversionRate), measure.size, measure.unit);
  if ("ok" in estimate) return Response.json({ message: estimate.message }, { status: 400 });
  if (body.action !== "complete") {
    return Response.json({ estimate, persisted: false });
  }
  if (estimate.packages < 1) {
    return Response.json({ message: "Hasil belum cukup untuk satu kemasan.", estimate }, { status: 400 });
  }
  const saved = await persistCompletedBatch({
    id: body.id || `batch-${Date.now()}`,
    species,
    rawKg: estimate.rawKg,
    conversionRate: estimate.conversionRate,
    variantId,
    estimate,
    collectedAt: new Date().toISOString(),
  });
  return Response.json({ estimate, ...saved });
}
