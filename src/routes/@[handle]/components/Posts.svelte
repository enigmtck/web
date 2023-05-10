<svelte:options accessors />

<script lang="ts">
	import Reply from '../../timeline/components/Reply.svelte';
	import Article from '../../timeline/components/Article.svelte';
	import Compose from '../../timeline/components/Compose.svelte';

	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { appData, enigmatickWasm } from '../../../stores';
	import type {
		UserProfile,
		Note,
		StreamConnect,
		Announce,
		AnnounceParams,
		Attachment
	} from '../../../common';
	import { insertEmojis, compare, sleep, DisplayNote, type Collection } from '../../../common';

	let composeComponent: Compose;
	export let local: boolean;
	export let handle: string;

	console.debug(`HANDLE ${handle}`);

	$: wasm = $enigmatickWasm;

	$: loadPosts(handle, local).then(() => {
		console.debug('RELOADED');
	});

	async function processCollection(collection: Collection) {
		const items = collection.orderedItems;
		console.debug(items);

		if (items) {
			for (const item of items) {
				if (item.type === 'Create') {
					addNote(<Note>item.object);
				} else if (item.type === 'Announce') {
					let note = await wasm?.get_note(String(item.object));
					if (note) {
						const n: Note = JSON.parse(note);
						console.debug(item);
						if (item.actor) {
							n.ephemeralAnnounces = [item.actor];
						}
						addNote(n);
					}
				}
			}
		}

		next = collection.next || null;
		prev = collection.prev || null;
	}

	async function loadPosts(handle: string, local: boolean) {
		notes = new Map<string, DisplayNote>();

		let state = await wasm?.get_state();
		if (state) {
			let server = state.get_server_url();

			if (local && handle) {
				const outbox = await wasm?.get_outbox(`${server}/user/${handle}/outbox?page=true`);

				if (outbox) {
					const collection: Collection = JSON.parse(outbox);
					console.debug(collection);
					processCollection(collection).then(() => {
						moreDisabled = false;
					});
				}
			} else {
				wasm?.get_remote_outbox(`@${handle}`).then((x) => {
					if (x) {
						const outbox: Collection = JSON.parse(x);

						wasm?.get_remote_outbox(`@${handle}`, outbox.first).then((x) => {
							if (x) {
								const collection: Collection = JSON.parse(x);
								processCollection(collection).then(() => {
									moreDisabled = false;
								});
							}
						});
					}
				});
			}
		}
	}

	async function loadMore(previous: boolean) {
		let url: string | null = null;
		if (!previous && next) {
			url = next;
		} else if (prev) {
			url = prev;
		}

		if (url) {
			moreDisabled = true;

			if (local) {
				wasm?.get_outbox(url).then((x) => {
					if (x) {
						const collection: Collection = JSON.parse(x);
						processCollection(collection).then(() => {
							moreDisabled = false;
						});
					}
				});
			} else {
				wasm?.get_remote_outbox(`@${handle}`, url).then((x) => {
					if (x) {
						const collection: Collection = JSON.parse(x);
						processCollection(collection).then(() => {
							moreDisabled = false;
						});
					}
				});
			}
		}
	}

	function refresh() {
		console.debug('REFRESH');

		notes.clear();
		loadPosts(handle, local).then((x) => {
			console.log('LOADED');
		});
	}

	function remove(note: string) {
		notes.delete(note);
		notes = notes;
	}

	async function addNote(note: Note) {
		if (note.ephemeralActors) {
			note.ephemeralActors.forEach((actor) => {
				if (actor.id) {
					apCache.set(actor.id, JSON.stringify(actor));
				}
			});
		}

		if (note.ephemeralLikes) {
			console.debug('EPHEMERAL LIKES');
			console.debug(note.ephemeralLikes);
		}

		const actor = await cachedActor(note.attributedTo);

		if (actor) {
			let actorProfile: UserProfile = JSON.parse(actor);
			const displayNote = new DisplayNote(actorProfile, note);

			if (!notes.get(String(note.id))) {
				notes.set(String(note.id), displayNote);
				locator.set(String(note.id), [String(note.id)]);
			}
		}

		notes = notes;
	}

	async function sender(
		recipientAddress: string | null,
		replyToMessageId: string | null,
		conversationId: string | null,
		content: string,
		attachments: Attachment[]
	): Promise<boolean> {
		return true;
	}

	function parseProfile(text: string | null | undefined): UserProfile | null {
		if (text) {
			try {
				return JSON.parse(text);
			} catch (e) {
				console.error('UNABLE TO PARSE PROFILE');
				console.debug(text);
				return null;
			}
		} else {
			console.error('UNABLE TO PARSE NULL OR UNDEFINED');
			return null;
		}
	}

	async function replyToHeader(note: Note): Promise<string | null> {
		if (note.inReplyTo) {
			const reply_note = await cachedNote(note.inReplyTo);

			if (reply_note) {
				const note: Note = JSON.parse(String(reply_note));

				const reply_actor = await cachedActor(note.attributedTo);

				const sender: UserProfile | null = parseProfile(reply_actor);

				if (sender) {
					const name = insertEmojis(sender.name || sender.preferredUsername, sender);

					return name;
				} else {
					return null;
				}
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	async function announceHeader(note: Note): Promise<AnnounceParams | null> {
		if (note.ephemeralAnnounces) {
			const announce_actor = await cachedActor(note.ephemeralAnnounces[0]);
			let others = '';

			if (note.ephemeralAnnounces.length == 2) {
				others = ` and ${note.ephemeralAnnounces.length - 1} other`;
			} else if (note.ephemeralAnnounces.length > 2) {
				others = ` and ${note.ephemeralAnnounces.length - 1} others`;
			}

			if (announce_actor) {
				const announce_profile: UserProfile | null = parseProfile(announce_actor);

				if (announce_profile) {
					const name = insertEmojis(
						announce_profile.name || announce_profile.preferredUsername,
						announce_profile
					);

					return <AnnounceParams>{ url: announce_profile.url, name, others };
				} else {
					return null;
				}
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	async function cachedActor(id: string) {
		if (wasm && !apCache.has(id)) {
			apCache.set(id, await wasm.get_actor(id));
		}

		return apCache.get(id);
	}

	async function cachedNote(id: string) {
		if (wasm && !apCache.has(id)) {
			apCache.set(id, await wasm.get_note(id));
		}

		return apCache.get(id);
	}

	function handleNoteSelect() {}

	// controls whether messages from EventSource are immediately displayed or queued
	let liveLoading = true;
	let infiniteScrollDisabled = false;

	// the queue used when the page is not scrolled to the top
	let noteQueue: Note[] = [];

	// HTML formatted notes to display in the Timeline
	// ap_id -> [published, note, replies, sender, in_reply_to, conversation]
	$: notes = new Map<string, DisplayNote>();

	// this is a map to locate a note within the nested notes structure;
	// the list is an ordered set of steps to access a note's location
	let locator = new Map<string, string[]>();
	let orphans: Set<DisplayNote> = new Set<DisplayNote>();

	// used very temporarily to control requests to the API for new data
	let loading = false;

	// the offset sent to the API for new data; adjusted when Notes are added by EventSource
	let offset = 0;

	// used to reduce calls to the API for Actor data
	let apCache = new Map<string, string | undefined>();

	let username = $appData.username;

	let focusNote: string | null = null;
	let focusConversation: string | null = null;

	let next: string | null = null;
	let prev: string | null = null;
	let moreDisabled = true;
</script>

{#if wasm}
	<Compose {sender} bind:this={composeComponent} />
{/if}

<main>
	{#if wasm}
		{#each Array.from(notes.values()).sort(compare).reverse() as note}
			{#if note.note}
				{#await replyToHeader(note.note) then replyTo}
					{#await announceHeader(note.note) then announce}
						<Article
							{remove}
							{refresh}
							{note}
							{username}
							replyToHeader={replyTo}
							announceHeader={announce}
							on:reply_to={composeComponent.handleReplyToMessage}
							on:note_select={handleNoteSelect}
						/>
					{/await}
				{/await}

				{#if note.note.id == focusNote && note.replies?.size}
					<div class="replies">
						{#each Array.from(note.replies.values()).sort(compare) as reply}
							<Reply
								note={reply}
								{username}
								on:reply_to={composeComponent.handleReplyToMessage}
								on:note_select={handleNoteSelect}
							/>
						{/each}
					</div>
				{/if}
			{/if}
		{/each}
		{#if next}
			<button on:click|preventDefault={() => loadMore(false)} disabled={moreDisabled}
				><i class="fa-solid fa-ellipsis" /></button
			>
		{/if}
	{/if}
</main>

<style lang="scss">
	main {
		padding: 10px 10px 60px 10px;

		button {
			border: 0;
			padding: 0;
			margin: 5px 0;
			background: inherit;
			width: 100%;
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

	:global(body.dark) {
		main {
			button {
				color: #777;
			}

			button:hover {
				color: red;
			}
		}
	}
</style>
