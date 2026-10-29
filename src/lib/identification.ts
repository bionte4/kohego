/** ISO 11784 animal RFID is a 15-digit numeric code. Visual ear tags stay separate. */
export function isIcarRfid(value: string) {
  return /^\d{15}$/.test(value);
}
