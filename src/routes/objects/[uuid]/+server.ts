import type { error, RequestEvent } from '@sveltejs/kit';

// This should only be used in development; normally nginx will handle routing application/json requests to this
// endpoint to Rocket directly

/** @type {import('./$types').RequestHandler} */
export async function GET(p: RequestEvent) {
  const resp = await fetch(`https://enigmatick.social/objects/${p.params.uuid}`)

  return new Response(await resp.text());
}