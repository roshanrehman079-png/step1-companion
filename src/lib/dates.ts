// Dates are YYYY-MM-DD strings in the learner's local time zone.

export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = parseLocal(iso); d.setDate(d.getDate() + n); return localDate(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseLocal(b).getTime() - parseLocal(a).getTime()) / 86400000)
}

export function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return parseLocal(iso).toLocaleDateString('en-GB', opts)
}
export const fmtLong = (iso: string) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'short' })
export const fmtShort = (iso: string) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtDay = (iso: string) => fmt(iso, { day: 'numeric' })
export const fmtWeekday = (iso: string) => fmt(iso, { weekday: 'short' })

/** Monday-start week containing iso. */
export function weekOf(iso: string): string[] {
  const d = parseLocal(iso); const dow = (d.getDay() + 6) % 7
  const start = addDays(iso, -dow)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}
