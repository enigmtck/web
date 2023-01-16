import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';

type AuthenticationData = {
    username: string;
    password: string;
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }: RequestEvent) {
    
  const data: AuthenticationData = await request.json();

  const resp = await fetch('http://192.168.37.221:8010/api/user/authenticate', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
          'Content-type': 'application/json; charset=UTF-8'
      }
  })

  return json(await resp.json())
}