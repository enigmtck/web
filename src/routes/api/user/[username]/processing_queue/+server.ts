import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import { page } from '$app/stores';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, request }: RequestEvent) {
    const { username } = params

    console.log(request.headers)

    const resp = await fetch('http://192.168.37.221:8010/api/user/' + username + "/processing_queue", {
        method: 'GET',
        headers: {
            'Content-type': 'application/json; charset=UTF-8'
        }
    })

    return json("{}")
}