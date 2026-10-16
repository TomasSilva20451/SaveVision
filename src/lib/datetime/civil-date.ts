import { appConfig } from "@/lib/config";

export const TIME_ZONE = appConfig.timeZone;

export type CivilDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

export type CivilTime = {
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
};

const civilDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const civilDateDisplayFormatter = new Intl.DateTimeFormat(appConfig.locale, {
  timeZone: TIME_ZONE,
  dateStyle: "long",
});

const zonedPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value;

  if (value === undefined) {
    throw new Error(`Parte de data em falta: ${type}`);
  }

  return Number(value);
}

function timeZoneOffsetMs(instant: Date): number {
  const parts = zonedPartsFormatter.formatToParts(instant);
  const asUtc = Date.UTC(
    readPart(parts, "year"),
    readPart(parts, "month") - 1,
    readPart(parts, "day"),
    readPart(parts, "hour"),
    readPart(parts, "minute"),
    readPart(parts, "second"),
  );

  return asUtc - instant.getTime();
}

export function civilDateFromInstant(instant: Date): CivilDate {
  const parts = civilDateFormatter.formatToParts(instant);

  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
  };
}

export function formatCivilDateIso(date: CivilDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

/** Interpreta `YYYY-MM-DD` como data civil em Europe/Lisbon (não UTC). */
export function parseCivilDateIso(iso: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    throw new Error(`Data civil inválida: ${iso}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function civilDateIsoToInstant(iso: string): Date {
  return startOfCivilDay(parseCivilDateIso(iso));
}

/** Converte uma data e hora civis de Lisboa para o instante UTC correspondente. */
export function zonedDateTimeToInstant(date: CivilDate, time: CivilTime): Date {
  const utcGuess = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    time.second ?? 0,
  );
  const firstOffset = timeZoneOffsetMs(new Date(utcGuess));
  const corrected = new Date(utcGuess - firstOffset);
  const secondOffset = timeZoneOffsetMs(corrected);

  if (secondOffset === firstOffset) {
    return corrected;
  }

  return new Date(utcGuess - secondOffset);
}

export function startOfCivilDay(date: CivilDate): Date {
  return zonedDateTimeToInstant(date, { hour: 0, minute: 0, second: 0 });
}

export function startOfCivilMonth(year: number, month: number): Date {
  return startOfCivilDay({ year, month, day: 1 });
}

export function startOfNextCivilMonth(year: number, month: number): Date {
  if (month === 12) {
    return startOfCivilMonth(year + 1, 1);
  }

  return startOfCivilMonth(year, month + 1);
}

export function formatCivilDate(date: CivilDate): string {
  return civilDateDisplayFormatter.format(
    zonedDateTimeToInstant(date, { hour: 12, minute: 0, second: 0 }),
  );
}

export function isInstantInCivilMonth(
  instant: Date,
  year: number,
  month: number,
): boolean {
  const start = startOfCivilMonth(year, month);
  const end = startOfNextCivilMonth(year, month);
  return instant >= start && instant < end;
}
