import { writable, type Writable } from 'svelte/store';

export const wasmState = writable('');
export const appData: Writable<{ username: string | null, display_name: string | null, avatar: string | null, domain: string | null, url: string | null}> = writable({ 'username': null, 'display_name': null, 'avatar': null, 'domain': null, 'url': null});
export const enigmatickWasm: Writable<typeof import('enigmatick_wasm') | null> = writable(null);
export const enigmatickOlm: Writable<typeof import('enigmatick_olm') | null> = writable(null);