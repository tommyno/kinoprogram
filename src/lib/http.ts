const USER_AGENT = 'oslokinoprogram/0.1';

const ATTEMPTS = 3;
// Longest a source may ask us to wait before trying again (Retry-After); asked to wait longer, we give up
const MAX_WAIT_MS = 60_000;

export function errorMessage(error: unknown): unknown {
  return error instanceof Error ? error.message : error;
}

/**
 * Fetches with our user agent and throws unless the source answers with success. A network error, a server error or
 * "too many requests" is tried again after a pause, so a brief blip at build time doesn't cost a source; any other
 * refusal, such as a missing file or a bad token, would only be refused again, so it fails at once.
 */
export async function fetchOk(
  source: string,
  url: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let res: Response | undefined;
    let error: unknown;
    try {
      res = await fetch(url, { ...init, headers: { ...init.headers, 'user-agent': USER_AGENT } });
      if (res.ok) return res;
      error = new Error(`${source} svarte ${res.status} ${res.statusText}`);
    } catch (networkError) {
      error = networkError;
    }
    // Retry-After in seconds, when the source says how long to wait
    const wait = Number(res?.headers.get('retry-after')) * 1000 || attempt * 5000;
    const retry = !res || res.status >= 500 || res.status === 429;
    if (!retry || attempt === ATTEMPTS || wait > MAX_WAIT_MS) throw error;
    console.warn(`${source} feilet (forsøk ${attempt} av ${ATTEMPTS}), prøver igjen: ${errorMessage(error)}`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}
