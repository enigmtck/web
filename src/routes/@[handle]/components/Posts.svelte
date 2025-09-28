<svelte:options accessors />

<script lang="ts">
	import Article from '../../timeline/components/Article.svelte';
	import Compose from '../../timeline/components/Compose.svelte';

	import { appData, enigmatickWasm } from '../../../stores';
	import type {
		UserProfile,
		Note,
		Attachment,
		Activity,
		UserProfileTerse,
		Article as ApArticle,
		Question
	} from '../../../common';
	import {
		DisplayNote,
		type Collection,
		extractMaxMin,
		isNote,
		isArticle,
		isQuestion,
		getFirstValue
	} from '../../../common';

	let composeComponent: Compose;
	export let local: boolean;
	export let handle: string;

	//console.debug(`HANDLE ${handle}`);

	$: wasm = $enigmatickWasm;

	$: loadPosts(handle, local).then(() => {
		//console.debug('RELOADED POSTS');
	});

	async function processCollection(collection: Collection) {
		const items = collection.orderedItems;
		//console.debug(items);

		if (items) {
			for (const item of items) {
				if (item.type === 'Create' || item.type === 'Announce') {
					let noteId = '';

					if  (item.object.id)
					//((isNote(item.object) || isArticle(item.object) || isQuestion(item.object)) &&
						//item.object.id) 
						{
						noteId = item.object.id;
					} else {
						noteId = String(item.object);
					}

					// Locally retrieved notes via the full webfinger (e.g., @jdt@enigmatick.social) already
					// have Ephemeral objects with public data. But they don't have user context 
					// (e.g., 'liked', 'announced', etc.)

					let retrieved = await cachedNote(noteId);
					//let retrieved = await wasm?.get_note(noteId);

					if (retrieved) {
						const n: Note | ApArticle | Question = JSON.parse(retrieved);
						(<Activity>item).object = n;
					}

					addNote(<Activity>item);
				}
			}
		}

		next = collection.next || null;
		prev = collection.prev || null;
	}

	async function loadPosts(handle: string, local: boolean) {
		//console.debug('RESETTING NOTES MAP');
		//console.debug(`Loading posts for ${handle}`);

		notes = new Map<string, DisplayNote>();

		if (!cache && wasm) {
			cache = new wasm.EnigmatickCache();
		}

		let state = wasm?.get_state();
		if (state) {
			let server = state.get_server_url();

			if (local && handle) {
				const outbox = await wasm?.get_outbox(handle);

				if (outbox) {
					const collection: Collection = JSON.parse(outbox);
					//console.debug(collection);
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

	async function loadMore() {
		let url: string | null = null;
		if (next) {
			url = next;
		} else if (prev) {
			url = prev;
		}

		//console.debug(`loadMore URL: ${url}`);

		if (url) {
			moreDisabled = true;

			if (local && handle) {
				let maxMin = extractMaxMin(url);
				//console.debug(`maxMin: ${maxMin}`);
				if (maxMin && maxMin.type && maxMin.value) {
					wasm?.get_outbox(handle, maxMin.type, maxMin.value).then((x) => {
						if (x) {
							const collection: Collection = JSON.parse(x);
							processCollection(collection).then(() => {
								moreDisabled = false;
							});
						}
					});
				}
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
		//console.debug('REFRESH');

		notes.clear();
		loadPosts(handle, local).then((x) => {
			//console.log('LOADED');
		});
	}

	function remove(note: string) {
		notes.delete(note);
		notes = notes;
	}

	async function placeNote(displayNote: DisplayNote) {
		const note = displayNote.note;

		if (!notes.get(String(note.id))) {
			notes.set(String(note.id), displayNote);
			apCache.set(String(note.id), JSON.stringify(note));
		}

		notes = notes;
	}

	const addNote = async (activity: Activity) => {
		//console.debug(`ADDING NOTE ${activity.object.type} ${activity.object.id}`)
		//console.debug(activity);
		if (activity.object.attributedTo) {
			const actor = getFirstValue(activity.object.ephemeral?.attributedTo);

			if (actor) {
				const displayNote = new DisplayNote(actor, activity.object, activity);
				await placeNote(displayNote);
			}
		}
	};

	async function senderFunction(
		replyToActor: UserProfile | UserProfileTerse | null,
		replyToNote: DisplayNote | null,
		content: string,
		attachments: Attachment[],
		mentions: Map<string, UserProfile>,
		hashtags: string[],
		directed: boolean
	): Promise<string | null | undefined> {
		if (wasm) {
			let params = (await wasm.SendParams.new()).set_content(content).set_public();

			if (!directed) {
				params.set_public();
			}

			params.set_attachments(JSON.stringify(attachments));
			params.set_hashtags(hashtags);

			for (const [webfinger, actor] of mentions) {
				params.add_mention(
					webfinger,
					actor.id || '',
					actor.capabilities?.enigmatickEncryption || false
				);
			}

			if (replyToNote) {
				params.set_in_reply_to(String(replyToNote.note.id));
				params.set_conversation(String(replyToNote.note.conversation));
			}

			return await wasm.send_note(params);
		} else {
			return null;
		}
	}

	async function cachedNote(id: string) {
		if (wasm && !apCache.has(id)) {
			apCache.set(id, wasm.get_note(id));
		}

		const cached = apCache.get(id);
		
		// Check if the cached value is a Promise that needs to be awaited
		if (cached instanceof Promise) {
			return await cached;
		}
		
		return cached;
	}

	function handleNoteSelect() {
		//console.debug('NOT IMPLEMENTED');
	}

	// ap_id -> [published, note, replies, sender, in_reply_to, conversation]
	let notes = new Map<string, DisplayNote>();

	// used to reduce calls to the API for Actor data
	let apCache = new Map<string, Promise<string | undefined> | string | undefined>();
	let cache: any = null;

	let username = $appData.username;

	let next: string | null = null;
	let prev: string | null = null;
	let moreDisabled = true;

	let articleRefs: any[] = [];
</script>

{#if wasm}
	<Compose {senderFunction} bind:this={composeComponent} direct={false} />
{/if}

<div>
	{#if wasm}
		{#each Array.from(notes.values()) as note, i}
			{#if note.note}
				<Article
					bind:this={articleRefs[i]}
					parentArticle={articleRefs[i]}
					{remove}
					{note}
					on:replyTo={composeComponent.handleReplyToMessage}
					on:noteSelect={handleNoteSelect}
					{cachedNote}
				/>
			{/if}
		{/each}
		{#if next}
			<button on:click|preventDefault={() => loadMore()} disabled={moreDisabled}
				><i class="fa-solid fa-ellipsis" /></button
			>
		{/if}
	{/if}
</div>

<style lang="scss">
	div {
		padding: 10px 10px 150px 10px;

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
		div {
			button {
				color: #777;
			}

			button:hover {
				color: red;
			}
		}
	}
</style>
