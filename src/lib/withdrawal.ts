export interface WithdrawalDose {
  medicineName: string;
  givenAt: string;
  withdrawalDays?: number;
}

export interface WithdrawalHold {
  medicineName: string;
  givenAt: string;
  until: string;
}

/**
 * A withdrawal window is the number of days printed on the product label.
 * Meat and milk stay locked until that date. This does not calculate a dose.
 */
export function activeHolds(doses: WithdrawalDose[], nowIso: string): WithdrawalHold[] {
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(now)) return [];
  return doses.flatMap((dose) => {
    const days = dose.withdrawalDays ?? 0;
    if (!Number.isInteger(days) || days <= 0) return [];
    const start = new Date(dose.givenAt).getTime();
    if (Number.isNaN(start)) return [];
    const untilMs = start + days * 24 * 60 * 60 * 1000;
    if (untilMs <= now) return [];
    return [{ medicineName: dose.medicineName, givenAt: dose.givenAt, until: new Date(untilMs).toISOString().slice(0, 10) }];
  });
}

export function saleBlockedMessage(doses: WithdrawalDose[], nowIso: string) {
  const holds = activeHolds(doses, nowIso);
  const first = holds[0];
  if (!first) return null;
  return `Periode henti obat sampai ${first.until}. Susu dan daging ${first.medicineName} belum boleh diedarkan.`;
}
