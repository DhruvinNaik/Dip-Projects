// Office-hours helpers shared by the admin reports and the Work & Verification export.
export const OFFICE_HOURS = { startHour: 9, startMin: 30, endHour: 18, endMin: 30 };
export const LUNCH = { startHour: 13, startMin: 0, endHour: 14, endMin: 0 };

export function isWorkingDay(date) {
  return date.getDay() !== 0; // Mon–Sat, Sunday off
}

export function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function clampToOfficeWindow(date) {
  const d = new Date(date);
  const officeStart = OFFICE_HOURS.startHour * 60 + OFFICE_HOURS.startMin;
  const officeEnd = OFFICE_HOURS.endHour * 60 + OFFICE_HOURS.endMin;
  let mins = minutesSinceMidnight(d);

  if (!isWorkingDay(d) || mins >= officeEnd) {
    // push to next working day's opening time
    do {
      d.setDate(d.getDate() + 1);
    } while (!isWorkingDay(d));
    d.setHours(OFFICE_HOURS.startHour, OFFICE_HOURS.startMin, 0, 0);
    return d;
  }
  if (mins < officeStart) {
    d.setHours(OFFICE_HOURS.startHour, OFFICE_HOURS.startMin, 0, 0);
    return d;
  }
  return d;
}

// Adds `hours` of business time (office hours, skipping lunch, Sundays) to a start Date.
export function addBusinessHours(startDate, hours) {
  if (!startDate || !hours) return null;
  let remainingMins = Math.round(hours * 60);
  let cursor = clampToOfficeWindow(startDate);

  const lunchStart = LUNCH.startHour * 60 + LUNCH.startMin;
  const lunchEnd = LUNCH.endHour * 60 + LUNCH.endMin;
  const officeEnd = OFFICE_HOURS.endHour * 60 + OFFICE_HOURS.endMin;

  while (remainingMins > 0) {
    let curMins = minutesSinceMidnight(cursor);
    // skip lunch
    if (curMins >= lunchStart && curMins < lunchEnd) {
      cursor.setHours(LUNCH.endHour, LUNCH.endMin, 0, 0);
      curMins = lunchEnd;
    }
    const segmentEnd = curMins < lunchStart ? lunchStart : officeEnd;
    const availableInSegment = segmentEnd - curMins;
    const take = Math.min(availableInSegment, remainingMins);
    cursor = new Date(cursor.getTime() + take * 60000);
    remainingMins -= take;

    if (remainingMins > 0) {
      cursor = clampToOfficeWindow(cursor);
    }
  }
  return cursor;
}

// Office hours elapsed between two instants (9:30–18:30, minus lunch, Sundays off).
export function officeHoursBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (!(e > s)) return 0;
  let totalMin = 0;
  const day = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  while (day <= e) {
    if (isWorkingDay(day)) {
      const at = (h, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).getTime();
      const windows = [
        [at(OFFICE_HOURS.startHour, OFFICE_HOURS.startMin), at(LUNCH.startHour, LUNCH.startMin)],
        [at(LUNCH.endHour, LUNCH.endMin), at(OFFICE_HOURS.endHour, OFFICE_HOURS.endMin)],
      ];
      windows.forEach(([ws, we]) => {
        const lo = Math.max(ws, s.getTime());
        const hi = Math.min(we, e.getTime());
        if (hi > lo) totalMin += (hi - lo) / 60000;
      });
    }
    day.setDate(day.getDate() + 1);
  }
  return totalMin / 60;
}

// Formats office hours as days (8 working hours per day) and hours, e.g. "2d 0.2h", "1.8h", "45m".
export function fmtOfficeHrs(h) {
  if (h == null || Number.isNaN(Number(h))) return "—";
  const n = Number(h);
  if (n < 1 / 60) return "<1m";
  if (n < 1) return `${Math.round(n * 60)}m`;
  if (n < 8) return `${n.toFixed(1)}h`;
  const days = Math.floor(n / 8);
  return `${days}d ${(n - days * 8).toFixed(1)}h`;
}

export function formatDurationShort(mins) {
  const totalMins = Math.round(Math.abs(mins));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
