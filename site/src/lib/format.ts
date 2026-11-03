export const fmt = (n: number) => n.toLocaleString("en-GB");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-11" or an ISO timestamp -> "11 Oct 2026" (IST) */
export const day = (iso: string) => {
  const d = new Date(/T/.test(iso) ? iso.replace("+00:00", "Z") : `${iso}T12:00:00+05:30`);
  const ist = new Date(d.getTime() + 5.5 * 3600e3);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
};
/** "2026-10" -> "Oct" */
export const monthShort = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1]!;
/** "2026-10" -> "October 2026" */
export const monthLong = (ym: string) => `${LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
/** "08:00" -> "8:00 AM", "23:30" -> "11:30 PM" */
export const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
/** "08:00 IST · Daily" -> "Daily, 8:00 AM IST"; other shifts unchanged */
export const shift = (s: string) => {
  const m = s.match(/^(\d{2}:\d{2}) IST · (\w+)/);
  return m ? `${m[2]}, ${time12(m[1]!)} IST` : s;
};
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
/** Numbers under ten as words in prose */
export const words = (n: number) => (n < 10 ? WORDS[n]! : fmt(n));
