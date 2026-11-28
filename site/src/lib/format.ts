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
// Text rules shared with the 3D scene data: one copy, in scene/data.mjs.
export { slug, shift, time12, hourOf } from "./scene/data.mjs";
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
/** Numbers under ten as words in prose */
export const words = (n: number) => (n < 10 ? WORDS[n]! : fmt(n));
