import { writable, type Writable } from 'svelte/store';

export const wasmState = writable('');
export const olmState = writable('');
export const appData: Writable<{ username: string | null, display_name: string | null }> = writable({'username': null, 'display_name': null })