<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { appData, enigmatickWasm } from '../../../stores';
	import type {
		UserProfile,
		Note,
		Announce,
		AnnounceParams,
		Attachment,
		Activity,
		UserProfileTerse
	} from '../../../common';
	import {
		insertEmojis,
		compare,
		sleep,
		DisplayNote,
		type Collection,
		extractMaxMin
	} from '../../../common';
	import Actor from './Actor.svelte';

	export let handle: string;
	export let local: boolean;
	export let view: 'Followers' | 'Following';
	export let cache: any;
	export let cachedActor: Function;

	let next: string | undefined = undefined;
	let moreDisabled = false;

	$: wasm = $enigmatickWasm;

	$: loadData(handle, local).then(() => {
		console.debug('RELOADED FOLLOWS');
	});

	const getFirstPageUrl = async (
		webfinger: string,
		local: boolean
	): Promise<string | undefined> => {
		if (view == 'Followers') {
			let data = await wasm?.get_remote_followers(webfinger);
			console.debug(data);
			if (data) {
				let collection: Collection = JSON.parse(data);
				return collection.first;
			}
		} else if (view == 'Following') {
			let data = await wasm?.get_remote_following(webfinger);
			if (data) {
				let collection: Collection = JSON.parse(data);
				return collection.first;
			}
		}

		return undefined;
	};

	const fetchProfiles = async (webfinger: string, url: string) => {
		const fetchMethod = view === 'Followers' ? 'get_remote_followers' : 'get_remote_following';

		const data = await wasm?.[fetchMethod](webfinger, url);
		if (!data) return null;

		const collection: Collection = JSON.parse(data);

		let fetchedProfiles: UserProfileTerse[] = [];

		if (collection.ephemeral?.actors) {
			fetchedProfiles = collection.ephemeral.actors;
		} else if (collection.orderedItems) {
			fetchedProfiles = await Promise.all(
				collection.orderedItems.map(async (item) => {
					try {
						const actor = await cachedActor(item, cache);
						return JSON.parse(actor);
					} catch (e) {
						console.error(`Failed to retrieve ${item}`);
						return null;
					}
				})
			).then((results) => results.filter(Boolean) as UserProfileTerse[]);
		}

		return { profiles: fetchedProfiles, next: collection.next };
	};

	const loadData = async (handle: string, local: boolean) => {
		const webfinger = local
			? (await wasm?.get_webfinger_from_handle(handle)) || handle
			: `@${handle}`;
		const first = await getFirstPageUrl(webfinger, local);

		if (!first) return;

		const result = await fetchProfiles(webfinger, first);
		if (result) {
			profiles = result.profiles;
			next = result.next;
		}
	};

	const loadMore = async () => {
		const webfinger = local
			? (await wasm?.get_webfinger_from_handle(handle)) || handle
			: `@${handle}`;

		if (!webfinger || !next) return;

		const result = await fetchProfiles(webfinger, next);
		if (result) {
			profiles = [...profiles, ...result.profiles];
			next = result.next;
		}
	};

	let profiles: UserProfileTerse[] = [];

	onMount(async () => {});
</script>

<div>
	{#each profiles as profile}
		<Actor {profile} />
	{/each}

	{#if next !== undefined}
		<button on:click|preventDefault={() => loadMore()} disabled={moreDisabled}
			><i class="fa-solid fa-ellipsis" /></button
		>
	{/if}
</div>

<style lang="scss">
	div {
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: center;
		padding: 10px 10px 60px 10px;

		Actor {
			width: 170px;
			margin: 20px;
		}

		button {
			position: relative;
			border: 0;
			width: 100%;
			margin: 5px 0;
			background: inherit;
			font-size: 36px;
			color: #444;
			transition-duration: 500ms;
		}

		button:disabled {
			pointer-events: none;
			display: none;
		}

		button:hover {
			cursor: pointer;
			color: red;
		}
	}
</style>
