/** Target band used by the mass-balance check. 25:1–30:1 and 55–70°C for at least three readings. */
export const COMPOST_STANDARD = {
  cnMin: 25,
  cnMax: 30,
  thermophilicMinC: 55,
  thermophilicMaxC: 70,
  thermophilicDays: 3,
} as const;

export interface CompostReading {
  day: number;
  celsius: number;
}

export interface CompostBalance {
  carbonPercent: number;
  nitrogenPercent: number;
  ratio: number;
  ratioLabel: string;
  rawKg: number;
  lossPercent: number;
  finishedKg: number;
  conversionRate: number;
  peakCelsius: number | null;
  thermophilicDays: number;
  curveLabel: string;
}

/**
 * Carbon divided by nitrogen. The target band is 25:1 to 30:1.
 * Below 20 the pile is too rich in nitrogen. Above 40 it stays cool and slow.
 * A thermophilic reading sits between 55°C and 70°C. Three such readings mark a held hot phase.
 * Finished mass is raw intake times the share that remains after the stated loss.
 */
export function compostBalance(input: {
  carbonPercent: number;
  nitrogenPercent: number;
  rawKg: number;
  lossPercent: number;
  readings: CompostReading[];
}): { ok: true; value: CompostBalance } | { ok: false; message: string } {
  const { carbonPercent, nitrogenPercent, rawKg, lossPercent, readings } = input;
  if (!Number.isFinite(carbonPercent) || carbonPercent <= 0 || carbonPercent > 80) {
    return { ok: false, message: "Karbon harus di atas 0 dan paling besar 80%." };
  }
  if (!Number.isFinite(nitrogenPercent) || nitrogenPercent <= 0 || nitrogenPercent > 20) {
    return { ok: false, message: "Nitrogen harus di atas 0 dan paling besar 20%." };
  }
  if (!Number.isFinite(rawKg) || rawKg <= 0 || rawKg > 10000) {
    return { ok: false, message: "Kohe segar harus di atas 0 dan paling besar 10.000 kg." };
  }
  if (!Number.isFinite(lossPercent) || lossPercent < 0 || lossPercent > 80) {
    return { ok: false, message: "Susut massa harus 0–80%." };
  }
  for (const reading of readings) {
    if (!Number.isInteger(reading.day) || reading.day < 1 || reading.day > 90) {
      return { ok: false, message: "Hari suhu harus bilangan 1–90." };
    }
    if (!Number.isFinite(reading.celsius) || reading.celsius < 10 || reading.celsius > 80) {
      return { ok: false, message: "Suhu kompos harus 10–80°C." };
    }
  }
  const ratio = Math.round((carbonPercent / nitrogenPercent) * 10) / 10;
  const ratioLabel =
    ratio < 20
      ? "Terlalu banyak nitrogen"
      : ratio < COMPOST_STANDARD.cnMin
        ? "Di bawah target 25–30"
        : ratio <= COMPOST_STANDARD.cnMax
          ? "Sesuai target 25–30"
          : ratio <= 40
            ? "Agak tinggi"
            : "Terlalu tinggi, proses lambat";
  const finishedKg = Math.round(rawKg * (1 - lossPercent / 100) * 10) / 10;
  const hot = readings.filter(
    (item) => item.celsius >= COMPOST_STANDARD.thermophilicMinC && item.celsius <= COMPOST_STANDARD.thermophilicMaxC,
  );
  const peak = readings.reduce<number | null>((best, item) => (best === null || item.celsius > best ? item.celsius : best), null);
  const curveLabel =
    hot.length >= COMPOST_STANDARD.thermophilicDays
      ? "Fase termofilik tercapai"
      : hot.length > 0
        ? "Suhu termofilik belum bertahan"
        : "Belum masuk fase termofilik";
  return {
    ok: true,
    value: {
      carbonPercent,
      nitrogenPercent,
      ratio,
      ratioLabel,
      rawKg,
      lossPercent,
      finishedKg,
      conversionRate: Math.round((1 - lossPercent / 100) * 1000) / 1000,
      peakCelsius: peak,
      thermophilicDays: hot.length,
      curveLabel,
    },
  };
}
