const USER_AGENT = 'oslokinoprogram/0.1';

const ATTEMPTS = 3;

export function errorMessage(error: unknown): unknown {
  return error instanceof Error ? error.message : error;
}

/** Tries a failed request again after a pause, so a brief network blip at build time doesn't cost a source. */
async function withRetry<T>(source: string, request: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.warn(`${source} feilet (forsøk ${attempt} av ${ATTEMPTS}), prøver igjen: ${errorMessage(error)}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}

/** Fetches with our user agent, retried, and throws unless the source answers with success. */
export function fetchOk(
  source: string,
  url: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<Response> {
  return withRetry(source, async () => {
    const res = await fetch(url, { ...init, headers: { ...init.headers, 'user-agent': USER_AGENT } });
    if (!res.ok) {
      throw new Error(`${source} svarte ${res.status} ${res.statusText}`);
    }
    return res;
  });
}
