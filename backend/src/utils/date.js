"use strict";

const DEFAULT_TIMEZONE =
  "UTC";

/**
 * Validate an IANA timezone.
 *
 * Examples:
 *
 * Asia/Kolkata
 * Asia/Dubai
 * America/New_York
 * Europe/London
 */
function isValidTimeZone(
  timeZone
) {
  if (
    typeof timeZone !==
      "string" ||
    !timeZone.trim()
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
      }
    ).format();

    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve timezone from either:
 *
 *   getTimezone("Asia/Kolkata")
 *
 * or:
 *
 *   getTimezone(req)
 */
function getTimezone(
  reqOrTimezone
) {
  const candidate =
    typeof reqOrTimezone ===
    "string"
      ? reqOrTimezone
      : reqOrTimezone?.user
          ?.timezone ||
        reqOrTimezone
          ?.headers?.[
          "x-timezone"
        ];

  return isValidTimeZone(
    candidate
  )
    ? candidate
    : DEFAULT_TIMEZONE;
}

/**
 * Convert a Date into a local calendar date key.
 *
 * Example:
 *
 *   Asia/Kolkata
 *   → 2026-08-21
 */
function getDateKey(
  date = new Date(),
  timeZone = DEFAULT_TIMEZONE
) {
  const safeTimezone =
    getTimezone(timeZone);

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: safeTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const values =
    Object.fromEntries(
      parts.map(
        ({
          type,
          value,
        }) => [
          type,
          value,
        ]
      )
    );

  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Get the timezone offset for a particular instant.
 *
 * The calculation intentionally uses the formatted local
 * date/time in the requested timezone and compares it with
 * the same wall-clock representation interpreted as UTC.
 */
function getTimeZoneOffsetMs(
  date,
  timeZone
) {
  const safeTimezone =
    getTimezone(timeZone);

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: safeTimezone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    ).formatToParts(date);

  const values =
    Object.fromEntries(
      parts.map(
        ({
          type,
          value,
        }) => [
          type,
          value,
        ]
      )
    );

  const hour =
    Number(values.hour) %
    24;

  const asUTC =
    Date.UTC(
      Number(values.year),
      Number(values.month) -
        1,
      Number(values.day),
      hour,
      Number(values.minute),
      Number(values.second)
    );

  return (
    asUTC -
    date.getTime()
  );
}

/**
 * Convert a local calendar date key's midnight to
 * the corresponding UTC instant.
 *
 * DST-safe approach:
 * calculate the offset, then calculate again using the
 * resulting instant because the offset can change around
 * DST transitions.
 */
function localMidnightFromDateKey(
  dateKey,
  timeZone
) {
  const safeTimezone =
    getTimezone(timeZone);

  const naiveUTC =
    new Date(
      `${dateKey}T00:00:00.000Z`
    );

  if (
    Number.isNaN(
      naiveUTC.getTime()
    )
  ) {
    throw new Error(
      `Invalid date key: ${dateKey}`
    );
  }

  let result =
    new Date(
      naiveUTC.getTime() -
        getTimeZoneOffsetMs(
          naiveUTC,
          safeTimezone
        )
    );

  /*
   * Recalculate once more to correctly handle timezone
   * transitions near midnight.
   */
  result =
    new Date(
      naiveUTC.getTime() -
        getTimeZoneOffsetMs(
          result,
          safeTimezone
        )
    );

  return result;
}

/**
 * Get the actual start of the local day.
 */
function getStartOfDay(
  date = new Date(),
  timeZone = DEFAULT_TIMEZONE
) {
  const safeTimezone =
    getTimezone(timeZone);

  const key =
    getDateKey(
      date,
      safeTimezone
    );

  return localMidnightFromDateKey(
    key,
    safeTimezone
  );
}

/**
 * Add/subtract calendar days from a YYYY-MM-DD key.
 *
 * This is deliberately based on calendar arithmetic rather
 * than milliseconds, so DST does not change the date.
 */
function addCalendarDays(
  dateKey,
  days
) {
  const date =
    new Date(
      `${dateKey}T00:00:00.000Z`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      `Invalid date key: ${dateKey}`
    );
  }

  date.setUTCDate(
    date.getUTCDate() +
      Number(days)
  );

  return date
    .toISOString()
    .slice(0, 10);
}

/**
 * Get a day range based on local calendar boundaries.
 *
 * end is the instant immediately before the next local midnight.
 */
function getDayRange(
  date = new Date(),
  timeZone = DEFAULT_TIMEZONE
) {
  const safeTimezone =
    getTimezone(timeZone);

  const dateKey =
    getDateKey(
      date,
      safeTimezone
    );

  const nextDateKey =
    addCalendarDays(
      dateKey,
      1
    );

  const start =
    localMidnightFromDateKey(
      dateKey,
      safeTimezone
    );

  const nextStart =
    localMidnightFromDateKey(
      nextDateKey,
      safeTimezone
    );

  return {
    start,
    end: new Date(
      nextStart.getTime() - 1
    ),
  };
}

/**
 * Get the range for a specific calendar date key.
 */
function getDateKeyRange(
  dateKey,
  timeZone = DEFAULT_TIMEZONE
) {
  const safeTimezone =
    getTimezone(timeZone);

  const nextDateKey =
    addCalendarDays(
      dateKey,
      1
    );

  const start =
    localMidnightFromDateKey(
      dateKey,
      safeTimezone
    );

  const nextStart =
    localMidnightFromDateKey(
      nextDateKey,
      safeTimezone
    );

  return {
    start,
    end: new Date(
      nextStart.getTime() - 1
    ),
  };
}

/**
 * Get a calendar date N days before/after another date.
 */
function getRelativeDateKey(
  date = new Date(),
  days = 0,
  timeZone = DEFAULT_TIMEZONE
) {
  const key =
    getDateKey(
      date,
      timeZone
    );

  return addCalendarDays(
    key,
    days
  );
}

module.exports = {
  DEFAULT_TIMEZONE,
  isValidTimeZone,
  getTimezone,
  getDateKey,
  getTimeZoneOffsetMs,
  localMidnightFromDateKey,
  getStartOfDay,
  getDayRange,
  getDateKeyRange,
  getRelativeDateKey,
  addCalendarDays,
};