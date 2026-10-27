const HOUR_MS = 3_600_000;

export function hoursToMs(hours: number): number {
  return hours * HOUR_MS;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute") };
}

export function hourInTimeZone(date: Date, timeZone: string): number {
  return zonedParts(date, timeZone).hour;
}

/** Midnight of the local day that contains `date`. */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const { year, month, day, hour, minute } = zonedParts(date, timeZone);
  const localNowAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMs = localNowAsUtc - Math.floor(date.getTime() / 60_000) * 60_000;
  return new Date(Date.UTC(year, month - 1, day) - offsetMs);
}
