import type { Program } from './program.ts';

/**
 * Throws when there is nothing to show today, so the build fails and Vercel keeps the previous deploy.
 */
export function assertPlausible(program: Program, today: string): void {
  if (!program.days[today]?.length) {
    throw new Error(`Filmweb-dataene ser feil ut: ingen visninger ${today}.`);
  }
}
