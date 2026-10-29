import { describe, expect, it } from 'vitest';
import { addDays, dayLabel, formatDuration, isPast, programNow, programSlot } from '../src/lib/time.ts';

describe('programSlot', () => {
  it('splits a start time into day, time and minutes', () => {
    expect(programSlot('2026-10-30T21:15:00')).toEqual({ day: '2026-10-30', minutes: 21 * 60 + 15, time: '21:15' });
  });

  it('keeps shows after midnight on their calendar day', () => {
    expect(programSlot('2026-10-31T00:15:00')).toEqual({ day: '2026-10-31', minutes: 15, time: '00:15' });
  });
});

describe('programNow', () => {
  it('uses Oslo time in winter (UTC+1)', () => {
    expect(programNow(new Date('2026-11-02T18:30:00Z'))).toEqual({ day: '2026-11-02', minutes: 19 * 60 + 30 });
  });

  it('uses Oslo time in summer (UTC+2)', () => {
    expect(programNow(new Date('2026-06-15T18:30:00Z'))).toEqual({ day: '2026-06-15', minutes: 20 * 60 + 30 });
  });

  it('switches day at midnight Oslo time, not UTC', () => {
    expect(programNow(new Date('2026-11-02T23:30:00Z'))).toEqual({ day: '2026-11-03', minutes: 30 });
  });
});

describe('isPast', () => {
  const now = { day: '2026-10-29', minutes: 19 * 60 + 35 };

  it('allows 15 minutes after the start', () => {
    expect(isPast({ day: '2026-10-29', minutes: 19 * 60 + 20 }, now)).toBe(false);
    expect(isPast({ day: '2026-10-29', minutes: 19 * 60 + 19 }, now)).toBe(true);
  });

  it('compares across days', () => {
    expect(isPast({ day: '2026-10-28', minutes: 23 * 60 }, now)).toBe(true);
    expect(isPast({ day: '2026-10-30', minutes: 10 * 60 }, now)).toBe(false);
  });
});

describe('labels', () => {
  it('names today, tomorrow and later days in Norwegian', () => {
    expect(dayLabel('2026-10-29', '2026-10-29')).toBe('i dag');
    expect(dayLabel('2026-10-30', '2026-10-29')).toBe('i morgen');
    expect(dayLabel('2026-10-31', '2026-10-29')).toBe('lørdag 31. oktober');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('formats durations', () => {
    expect(formatDuration(110)).toBe('1 t 50 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(null)).toBe('');
  });
});
