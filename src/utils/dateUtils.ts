export function getMondayOfCurrentWeek(referenceDate: Date = new Date()): Date {
  const d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatDateISO(dt);
}

export function getWeekDates(startMonday: Date, weekOffset: number): string[] {
  const base = new Date(startMonday);
  base.setDate(base.getDate() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return formatDateISO(d);
  });
}

export function formatShortDayHeader(isoDate: string): { weekday: string; dayNum: string; monthShort: string } {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const monthShort = dt.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = String(d);
  return { weekday, dayNum, monthShort };
}

export function formatWeekRangeLabel(dates: string[]): string {
  if (!dates.length) return '';
  const first = formatShortDayHeader(dates[0]);
  const last = formatShortDayHeader(dates[dates.length - 1]);
  if (first.monthShort === last.monthShort) {
    return `${first.monthShort} ${first.dayNum} – ${last.dayNum}`;
  }
  return `${first.monthShort} ${first.dayNum} – ${last.monthShort} ${last.dayNum}`;
}

export function formatFullDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
