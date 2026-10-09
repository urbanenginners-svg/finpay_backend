import { BadRequestException } from '@nestjs/common';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import {
  ANALYTICS_DEFAULT_RANGE_DAYS,
  ANALYTICS_DEFAULT_TIMEZONE,
  ANALYTICS_MAX_RANGE_DAYS,
} from './constants/analytics.constants';

export interface ResolvedRange {
  from: Date;
  to: Date;
  tz: string;
  /** Inclusive calendar dates in `tz`, used to zero-fill daily series. */
  fromDate: string;
  toDate: string;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Browsers (Chrome/ICU) still report some legacy IANA names, but MongoDB's
 * time zone database may not know them and fails the whole aggregation.
 */
const LEGACY_TIMEZONES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Dacca': 'Asia/Dhaka',
  'Asia/Thimbu': 'Asia/Thimphu',
  'Asia/Ujung_Pandang': 'Asia/Makassar',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Asia/Chongqing': 'Asia/Shanghai',
  'Asia/Harbin': 'Asia/Shanghai',
  'Asia/Macao': 'Asia/Macau',
  'Asia/Istanbul': 'Europe/Istanbul',
  'Europe/Kiev': 'Europe/Kyiv',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Louisville': 'America/Kentucky/Louisville',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Australia/Canberra': 'Australia/Sydney',
};

export function resolveTimezone(tz?: string): string {
  const requested = tz?.trim() || ANALYTICS_DEFAULT_TIMEZONE;
  const zone = LEGACY_TIMEZONES[requested] ?? requested;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    throw new BadRequestException(`Unknown timezone '${zone}'`);
  }
}

function parseBoundary(value: string, tz: string, endOfDay: boolean): Date {
  if (DATE_ONLY.test(value)) {
    return fromZonedTime(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`, tz);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date '${value}'`);
  }
  return date;
}

export function resolveRange(query: { from?: string; to?: string; tz?: string }): ResolvedRange {
  const tz = resolveTimezone(query.tz);
  const now = new Date();

  const to = query.to ? parseBoundary(query.to, tz, true) : parseBoundary(formatInTimeZone(now, tz, 'yyyy-MM-dd'), tz, true);
  const from = query.from
    ? parseBoundary(query.from, tz, false)
    : parseBoundary(
        formatInTimeZone(new Date(to.getTime() - (ANALYTICS_DEFAULT_RANGE_DAYS - 1) * DAY_MS), tz, 'yyyy-MM-dd'),
        tz,
        false,
      );

  if (from > to) {
    throw new BadRequestException('`from` must be on or before `to`');
  }
  if (to.getTime() - from.getTime() > ANALYTICS_MAX_RANGE_DAYS * DAY_MS) {
    throw new BadRequestException(`Date range cannot exceed ${ANALYTICS_MAX_RANGE_DAYS} days`);
  }

  return {
    from,
    to,
    tz,
    fromDate: formatInTimeZone(from, tz, 'yyyy-MM-dd'),
    toDate: formatInTimeZone(to, tz, 'yyyy-MM-dd'),
  };
}

export function previousRange(range: ResolvedRange): { from: Date; to: Date } {
  const length = range.to.getTime() - range.from.getTime() + 1;
  return { from: new Date(range.from.getTime() - length), to: new Date(range.from.getTime() - 1) };
}

export function eachDate(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
