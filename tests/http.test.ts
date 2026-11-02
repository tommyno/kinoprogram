import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOk } from '../src/lib/http.ts';

describe('fetchOk', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fails at once when the source refuses, as it would refuse again', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' }));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchOk('Kilde', 'https://example.test/')).rejects.toThrow('Kilde svarte 404 Not Found');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('tries a server error again, after as long as the source asks', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '2' } }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    const response = fetchOk('Kilde', 'https://example.test/');
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1 + 10_000);
    expect(await (await response).text()).toBe('ok');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up when asked to wait more than a minute', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 429, headers: { 'retry-after': '3600' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchOk('Kilde', 'https://example.test/')).rejects.toThrow('Kilde svarte 429');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
