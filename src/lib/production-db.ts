import { Prisma } from "@prisma/client";
import { PRODUCTS } from "@/lib/catalog";
import { getDb } from "@/lib/social/db";
import type { LivestockSpecies } from "@/lib/livestock";
import type { ProductionEstimate } from "@/lib/production";
import type { VariantId } from "@/lib/types";

const CATEGORY = {
  sapi: "SAPI",
  kambing: "KAMBING",
  ayam: "AYAM",
  bebek: "BEBEK",
} as const;

export async function persistCompletedBatch(input: {
  id: string;
  species: LivestockSpecies;
  rawKg: number;
  conversionRate: number;
  variantId: VariantId;
  estimate: ProductionEstimate;
  collectedAt: string;
}) {
  const db = getDb();
  if (!db) return { persisted: false as const };
  const product = PRODUCTS.find((item) => item.id === input.variantId);
  if (!product) return { persisted: false as const, message: "Varian tidak dikenal." };
  const category = CATEGORY[input.species];
  try {
    await db.$transaction(async (tx) => {
      const logs = await tx.wasteCollectionLog.findMany({
        where: { category, remainingKg: { gt: 0 } },
        orderBy: { collectedAt: "asc" },
      });
      let need = input.rawKg;
      if (logs.length === 0) {
        await tx.wasteCollectionLog.create({
          data: {
            id: `${input.id}-log`,
            category,
            weightKg: input.rawKg,
            remainingKg: 0,
            collectedAt: new Date(input.collectedAt),
          },
        });
      } else {
        for (const log of logs) {
          if (need <= 0.05) break;
          const remaining = Number(log.remainingKg);
          const take = Math.min(remaining, need);
          need -= take;
          await tx.wasteCollectionLog.update({
            where: { id: log.id },
            data: { remainingKg: new Prisma.Decimal(Math.round((remaining - take) * 10) / 10) },
          });
        }
        if (need > 0.05) {
          throw new Error("Kohe di database tidak mencukupi.");
        }
      }
      await tx.productVariant.upsert({
        where: { id: input.variantId },
        create: {
          id: input.variantId,
          label: product.label,
          family: product.family,
          packageSize: input.estimate.packageSize,
          unit: product.unit,
          stockOnHand: input.estimate.packages,
        },
        update: { stockOnHand: { increment: input.estimate.packages } },
      });
      await tx.productionBatch.create({
        data: {
          id: input.id,
          category,
          rawWeightKg: input.rawKg,
          conversionRate: input.conversionRate,
          variantId: input.variantId,
          packageSize: input.estimate.packageSize,
          outputUnits: input.estimate.packages,
          status: "COMPLETED",
          completedAt: new Date(input.collectedAt),
        },
      });
    });
    return { persisted: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch tidak tersimpan di database.";
    return { persisted: false as const, message: message.slice(0, 180) };
  }
}
