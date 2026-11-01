export const USER_AGENT = 'oslokinoprogram/0.1';

const ATTEMPTS = 3;

/** Tries a failed request again after a pause, so a brief network blip at build time doesn't cost a source. */
export async function withRetry<T>(source: string, request: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.warn(`${source} feilet (forsøk ${attempt} av ${ATTEMPTS}), prøver igjen: ${error instanceof Error ? error.message : error}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}
