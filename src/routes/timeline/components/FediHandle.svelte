<script lang="ts">
	import { onMount } from 'svelte';

	export let handle: string;

	let username = '';
	let server = '';

	interface ParsedHandle {
		username: string;
		server: string;
	}

	function parseHandleString(fediHandle: string): ParsedHandle | null {
		const cleanHandle = fediHandle.startsWith('@') ? fediHandle.slice(1) : fediHandle;
		const parts = cleanHandle.split('@');

		if (parts.length === 2) {
			return {
				username: parts[0],
				server: parts[1]
			};
		}
		return null;
	}

	function parseHandle(fediHandle: string): void {
		const parsed = parseHandleString(fediHandle);

		if (parsed) {
			username = parsed.username;
			server = parsed.server;
		} else {
			console.error('Invalid Fediverse handle format');
			username = '';
			server = '';
		}
	}

	onMount(() => {
		parseHandle(handle);
	});
</script>

<div class="fedi-handle">
	<span class="username">@{username}</span>
	{#if server}
		<span class="server">
			<span class="server-name">{server}</span>
		</span>
	{/if}
</div>

<style>
	.fedi-handle {
		display: flex;
		white-space: nowrap;
        align-items: center;
        flex-wrap: wrap;
	}

	.username {
		flex-direction: row;
		display: inline-block;
        margin-right: 10px;
        padding-bottom: 0.1rem;
		color: darkgoldenrod;
	}

	.server {
		display: inline-block;
		align-items: center;
		padding: 0 0.5rem 0.3rem 0.5rem;
		border-radius: 5px;
		background-color: #eee;
        margin: 2px 0;
		color: #555;
		white-space: nowrap;
        font-weight: 800;
	}

	:global(body.dark .server) {
		background-color: #333;
		color: #aaa;
	}

	.server-name {
		font-variant: all-small-caps;
		font-size: 0.9em;
	}
</style>
