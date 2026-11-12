/**
 * Sunrise and sunset, calculated with the standard NOAA solar equations.
 * Accurate to about a minute at Big Bear's latitude. No outside data needed.
 */
export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Sunrise and sunset for the calendar day (in the given time zone offset) that contains `at`. */
export function sunTimes(at: Date, lat: number, lon: number, utcOffsetHours: number): SunTimes {
  // Local calendar date at the location.
  const local = new Date(at.getTime() + utcOffsetHours * 3600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();

  // Julian day at local noon, then Julian century.
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const jd = jdn - utcOffsetHours / 24; // local noon in UT
  const t = (jd - 2451545) / 36525;

  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const mAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(rad(mAnom)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * mAnom)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * mAnom)) * 0.000289;
  const trueLong = l0 + c;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));
  const obliq0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));
  const decl = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(appLong))));
  const vy = Math.tan(rad(obliq / 2)) ** 2;
  const eqTime =
    4 *
    deg(
      vy * Math.sin(2 * rad(l0)) -
        2 * e * Math.sin(rad(mAnom)) +
        4 * e * vy * Math.sin(rad(mAnom)) * Math.cos(2 * rad(l0)) -
        0.5 * vy * vy * Math.sin(4 * rad(l0)) -
        1.25 * e * e * Math.sin(2 * rad(mAnom)),
    );
  // 90.833 degrees: the sun's upper edge on the horizon, allowing for refraction.
  const ha = deg(
    Math.acos(Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(decl))) - Math.tan(rad(lat)) * Math.tan(rad(decl))),
  );
  const noonMin = 720 - 4 * lon - eqTime + utcOffsetHours * 60; // minutes after local midnight
  const midnightUtc = Date.UTC(y, m - 1, d) - utcOffsetHours * 3600_000;
  const atMin = (min: number) => new Date(midnightUtc + min * 60_000);
  return { sunrise: atMin(noonMin - ha * 4), sunset: atMin(noonMin + ha * 4) };
}

/** Hours offset from UTC for a time zone at a given moment (handles daylight saving). */
export function utcOffsetHours(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return Math.round((asUtc - at.getTime()) / 3600_000);
}
