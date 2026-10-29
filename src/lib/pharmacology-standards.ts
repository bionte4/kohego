import type { LivestockSpecies } from "@/lib/livestock";

export const RESIDUE_NOTE =
  "Batas residu (MRL) mengikuti angka pada label produk dan ketetapan otoritas yang berlaku. Aplikasi mengunci hari henti obat dan tidak menghitung mg/kg.";

export interface PharmacologyStandard {
  id: string;
  medicineName: string;
  species: LivestockSpecies | "semua";
  /** Zero means the keeper copies the day count from the label. The app does not invent one. */
  withdrawalDays: number;
  blocksHarvest: boolean;
  blocksManure: boolean;
  residueNote: string;
}

/**
 * Keeper medicines already used on the treatment checklist.
 * Withdrawal days on a recorded dose still come from the label, not from this row.
 */
export const PHARMACOLOGY_STANDARDS: PharmacologyStandard[] = [
  {
    id: "std-elektrolit",
    medicineName: "Elektrolit oral",
    species: "semua",
    withdrawalDays: 0,
    blocksHarvest: true,
    blocksManure: true,
    residueNote: RESIDUE_NOTE,
  },
  {
    id: "std-antiseptik",
    medicineName: "Antiseptik luka luar",
    species: "semua",
    withdrawalDays: 0,
    blocksHarvest: true,
    blocksManure: true,
    residueNote: RESIDUE_NOTE,
  },
];

export function standardFor(medicineName: string) {
  const name = medicineName.trim().toLowerCase();
  if (!name) return null;
  return (
    PHARMACOLOGY_STANDARDS.find((item) => {
      const reference = item.medicineName.toLowerCase();
      return reference.includes(name) || name.includes(reference);
    }) ?? null
  );
}
