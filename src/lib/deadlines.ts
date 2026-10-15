export function isLateSubmission(submittedAtIso: string | null, dueAtIso: string): boolean {
  if (!submittedAtIso) return false
  const submitted = Date.parse(submittedAtIso)
  const due = Date.parse(dueAtIso)
  if (Number.isNaN(submitted) || Number.isNaN(due)) return false
  return submitted > due
}

export function formatInTimeZone(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return `${date.toISOString()} (invalid time zone ${timeZone})`
  }
}

export function formatDeadline(iso: string, timeZone: string): string {
  return `${formatInTimeZone(iso, timeZone)} (${timeZone})`
}

export function zonedLocalToUtcIso(localValue: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue)
  if (!match) throw new Error('Enter a valid date and time.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new Error('Enter a valid date and time.')
  }
  assertTimeZone(timeZone)
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const firstOffset = zoneOffsetMs(utcGuess, timeZone)
  const corrected = utcGuess - firstOffset
  const secondOffset = zoneOffsetMs(corrected, timeZone)
  return new Date(utcGuess - secondOffset).toISOString()
}

export function utcIsoToZonedInput(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid deadline.')
  assertTimeZone(timeZone)
  const parts = readZonedParts(date.getTime(), timeZone)
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

export function timeZoneOptions(): string[] {
  const supported = Intl.supportedValuesOf('timeZone')
  const preferred = [
    'UTC',
    'Africa/Lagos',
    'Africa/Accra',
    'Africa/Johannesburg',
    'Europe/London',
    'Europe/Paris',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Australia/Sydney',
  ]
  const knownPreferred = preferred.filter((zone) => zone === 'UTC' || supported.includes(zone))
  return [...knownPreferred, ...supported.filter((zone) => !knownPreferred.includes(zone))]
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function assertTimeZone(timeZone: string): void {
  Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date())
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = readZonedParts(utcMs, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - utcMs
}

function readZonedParts(utcMs: number, timeZone: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  let hour = value('hour')
  if (hour === 24) hour = 0
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour,
    minute: value('minute'),
    second: value('second'),
  }
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}
