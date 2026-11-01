// Landing dates. Delay 0 = the planned landing date below.
export const PLANNED_LANDING = Date.UTC(2027, 2, 1); // 1 March 2027, 00:00 UTC
export const CALENDAR_DAYS = 60;
export const MAX_DELAY_H = (CALENDAR_DAYS - 1) * 24;

const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function landingDate(delayH: number): Date {
  return new Date(PLANNED_LANDING + delayH * 3600_000);
}

export function landingLabel(delayH: number): string {
  return fmt.format(landingDate(delayH));
}