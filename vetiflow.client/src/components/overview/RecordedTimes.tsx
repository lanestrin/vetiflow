import { measuredAgeLabel, recordTimeLabel } from "./overviewFormat";

// When a vitals set was measured, kept apart from when it was entered (4.11b).
// withTime adds the absolute event time after an elapsed age; an unknown,
// invalid or future time shows only its label.
export function MeasuredTime({ occurredAt, now, withTime = false }: { occurredAt: string | null | undefined; now: Date; withTime?: boolean }) {
  const hasAge = now.getTime() - Date.parse(occurredAt ?? "") >= 0;
  const time = withTime && hasAge ? recordTimeLabel(occurredAt, now) : null;
  const age = measuredAgeLabel(occurredAt, now);
  return time !== null && occurredAt
    ? <>{age} · <time dateTime={occurredAt}>{time}</time></>
    : <>{age}</>;
}

// "Entered 10:42 AM", or "Entry time unavailable" for an invalid time.
export function EnteredTime({ recordedAt, now }: { recordedAt: string; now: Date }) {
  const time = recordTimeLabel(recordedAt, now);
  return time === null
    ? <>Entry time unavailable</>
    : <>Entered <time dateTime={recordedAt}>{time}</time></>;
}
