/** Formats seconds as m:ss, or m:ss.t when `decimals` is set. Non-finite values show a dash. */
export function fmtTime(t: number | null | undefined, decimals = false): string {
  if (t == null || !isFinite(t)) return '—';
  const m = Math.floor(t / 60);
  const sec = t - m * 60;
  return m + ':' + (decimals ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0'));
}
