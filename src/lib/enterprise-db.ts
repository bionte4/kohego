import { Prisma } from "@prisma/client";
import type { CompostBalance } from "@/lib/compost";
import type { ConsignmentRow } from "@/lib/consignment";
import { PHARMACOLOGY_STANDARDS } from "@/lib/pharmacology-standards";
import { VETERINARY_RULES } from "@/lib/veterinary-rules";
import type { FieldVisit } from "@/lib/types";
import { getDb } from "@/lib/social/db";

function missed(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2021" || error.code === "P2022");
}

export async function persistLineage(input: { id: string; earTag: string; sireTag: string; damTag: string; stage: string }) {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    await db.lineageTracking.upsert({
      where: { earTag: input.earTag },
      create: input,
      update: { sireTag: input.sireTag, damTag: input.damTag, stage: input.stage },
    });
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}

export async function persistCompost(id: string, value: CompostBalance) {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    await db.compostRun.create({
      data: {
        id,
        rawKg: value.rawKg.toFixed(1),
        carbonPercent: value.carbonPercent.toFixed(2),
        nitrogenPercent: value.nitrogenPercent.toFixed(2),
        cnRatio: value.ratio.toFixed(1),
        lossPercent: value.lossPercent.toFixed(2),
        finishedKg: value.finishedKg.toFixed(1),
        peakCelsius: value.peakCelsius === null ? null : value.peakCelsius.toFixed(1),
        thermophilicDays: value.thermophilicDays,
      },
    });
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}

export async function persistConsignment(period: string, rows: ConsignmentRow[]) {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    const byPartner = new Map<string, ConsignmentRow>();
    for (const row of rows) {
      const current = byPartner.get(row.partnerId);
      if (!current) byPartner.set(row.partnerId, row);
      else current.openIdr += row.openIdr;
    }
    for (const row of byPartner.values()) {
      await db.consignmentLedger.upsert({
        where: { partnerId_period: { partnerId: row.partnerId, period } },
        create: {
          id: `csg-${row.partnerId}-${period}`,
          partnerId: row.partnerId,
          period,
          openIdr: row.openIdr,
          volumeKg: row.volumeKg.toFixed(3),
          discountRate: row.tier.rate.toFixed(4),
          suggestedCreditIdr: row.suggestedCreditIdr,
        },
        update: {
          openIdr: row.openIdr,
          volumeKg: row.volumeKg.toFixed(3),
          discountRate: row.tier.rate.toFixed(4),
          suggestedCreditIdr: row.suggestedCreditIdr,
        },
      });
    }
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}

export async function persistVisit(visit: FieldVisit) {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    await db.fieldVisit.create({
      data: {
        id: visit.id,
        partnerId: visit.partnerId,
        agentId: visit.agentId,
        visitedAt: new Date(visit.visitedAt),
        lat: visit.geo ? visit.geo.lat.toFixed(6) : null,
        lng: visit.geo ? visit.geo.lng.toFixed(6) : null,
        note: visit.note,
      },
    });
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}

export async function persistVeterinaryRules() {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    const count = await db.veterinaryRule.count();
    if (count > 0) return { stored: true as const };
    await db.veterinaryRule.createMany({
      data: VETERINARY_RULES.map((rule) => ({ id: rule.id, symptom: rule.symptom, protocolId: rule.protocolId, summary: rule.summary })),
    });
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}

export async function persistRegistry(input: { earTag: string; rfidTag: string }) {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    await db.livestockRegistry.upsert({
      where: { earTag: input.earTag },
      create: input,
      update: { rfidTag: input.rfidTag },
    });
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}

export async function persistPharmacologyStandards() {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    const count = await db.pharmacologyStandard.count();
    if (count > 0) return { stored: true as const };
    await db.pharmacologyStandard.createMany({
      data: PHARMACOLOGY_STANDARDS.map((item) => ({
        id: item.id,
        medicineName: item.medicineName,
        species: item.species,
        withdrawalDays: item.withdrawalDays,
        blocksHarvest: item.blocksHarvest,
        blocksManure: item.blocksManure,
        residueNote: item.residueNote,
      })),
    });
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}

export async function persistWithdrawal(input: { id: string; earTag: string; medicineName: string; startedAt: string; untilOn: string }) {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    await db.withdrawalHold.create({
      data: {
        id: input.id,
        earTag: input.earTag,
        medicineName: input.medicineName,
        startedAt: new Date(input.startedAt),
        untilOn: new Date(`${input.untilOn}T00:00:00.000Z`),
      },
    });
    return { stored: true as const };
  } catch (error) {
    if (missed(error)) return { stored: false as const };
    throw error;
  }
}
