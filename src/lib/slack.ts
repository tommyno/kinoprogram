import { errorMessage, fetchOk } from './http.ts';

/** Posts to the Slack channel behind SLACK_WEBHOOK_URL, when it is set. A failed post is only logged, so it never stops the build. */
export async function notifySlack(text: string): Promise<void> {
  const url = import.meta.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetchOk('Slack', url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.warn(`Kunne ikke varsle Slack: ${errorMessage(error)}`);
  }
}
