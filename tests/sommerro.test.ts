import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CINEMA, parseDate, parsePage, sommerroProgram } from '../src/lib/sources/sommerro.ts';

function block(name: string, date: string): string {
  return `<div class="events-listing-block__items__item less-height-events">
    <a href="https://www.sommerrohouse.com/events/winedinecrime/" class="event-listing-root-link">
      <span class="events-listing-block__items__item__heading">WINE, DINE &amp; CRIME</span>
      <p style="font-weight: 700;">${name}</p>
      <p>Et intenst   krimdrama.</p>
      <span class="events-listing-block__items__item__date date-lang-support" data-timezone="UTC">
        ${date}
      </span>
    </a>
  </div>`;
}

function page(...blocks: string[]): string {
  return `<div class="events-listing-block events-listing-block--big">${blocks.join('')}</div>`;
}

describe('parseDate', () => {
  it.each([
    ['4. November kl 18:00 - 22:00', '2026-11-02', '2026-11-04T18:00:00'],
    ['11. desember kl 16:00', '2026-11-02', '2026-12-11T16:00:00'],
    // A date well before today is next year's
    ['10. January kl 15:00', '2026-11-02', '2027-01-10T15:00:00'],
    // One just gone is still this year's
    ['20. October kl 18:00', '2026-11-02', '2026-10-20T18:00:00'],
  ])('%s', (text, today, expected) => {
    expect(parseDate(text, today)).toBe(expected);
  });

  it('reads no date from other text', () => {
    expect(parseDate('Kommer snart', '2026-11-02')).toBeNull();
  });
});

describe('parsePage', () => {
  it('reads each screening', () => {
    expect(parsePage(page(block("Breakfast at Tiffany&#8217;s (1961) ", '4. November kl 18:00 - 22:00')), '2026-11-02')).toEqual([
      {
        title: 'Breakfast at Tiffany’s',
        year: 1961,
        synopsis: 'Et intenst krimdrama.',
        url: 'https://www.sommerrohouse.com/events/winedinecrime/',
        start: '2026-11-04T18:00:00',
      },
    ]);
  });

  it('fails when it finds no screenings, rather than showing none', () => {
    expect(() => parsePage('<html></html>', '2026-11-02')).toThrow();
    expect(() => parsePage(page(block('Serpico (1973)', 'Kommer snart')), '2026-11-02')).toThrow();
  });
});

describe('sommerroProgram', () => {
  it('makes a film per title, with times linking to the series page', () => {
    const program = sommerroProgram(parsePage(page(block('Serpico (1973)', '4. November kl 18:00')), '2026-11-02'));
    expect(program.films['SOMMERRO:serpico']).toMatchObject({ title: 'Serpico', year: 1973, slug: 'sommerro-serpico' });
    expect(program.days['2026-11-04'][0]).toMatchObject({
      cinema: CINEMA,
      time: '18:00',
      bookingUrl: 'https://www.sommerrohouse.com/events/winedinecrime/',
    });
  });
});

describe('the Sommerro fixture', () => {
  it('has screenings of films with a year', () => {
    const program = sommerroProgram(parsePage(readFileSync('tests/fixtures/sommerro.html', 'utf8'), '2026-11-02'));
    expect(Object.values(program.days).flat().length).toBeGreaterThan(0);
    expect(Object.values(program.films).every((f) => f.year)).toBe(true);
  });
});
