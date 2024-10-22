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

	let composeComponent: Compose;
	export let local: boolean;
	export let handle: string;
	export let actorId: string | undefined;

	let retrievedConversations: Set<string> = new Set();
	let currentIds: Array<string> = new Array();
	let observer: IntersectionObserver | null = null;
	function onIntersection(entries: IntersectionObserverEntry[]) {
		for (let entry of entries) {
			if (entry.target) {
				let target = <HTMLElement>entry.target;
				if (entry.isIntersecting) {
					if (target.dataset) {
						let dataset = <DOMStringMap>target.dataset;
						console.log(dataset.conversation);
						if (wasm && dataset.conversation) {
							let conversation = dataset.conversation;

							if (!retrievedConversations.has(conversation)) {
								retrievedConversations.add(conversation);
								wasm
									.get_conversation(encodeURIComponent(dataset.conversation), 50)
									.then((conversation) => {
										if (conversation) {
											let collection: Collection = JSON.parse(conversation);

											collection.orderedItems?.forEach((a: Activity) => {
												console.debug(a);
												if (a.object.inReplyTo) {
													addNote(a.object);
												}
											});

											placeOrphans(true);
										}
									});
							}
						}
					}
				} else {
					let index = currentIds.indexOf(target.id);
					if (index !== -1) {
						currentIds.splice(index, 1);
					}
				}
			}
		}
	}

	function observeNote(note: any) {
		if (observer) {
			observer.observe(note);
		}
	}

	onMount(async () => {
		// Commenting this out until I have time to think about how to add comments to top-level notes
		// in this context (i.e., adding comments to notes that are not direct ancestors, but are in the
		// same conversation). Timeline relies on the inReplyTo to manage these relationships.
		// observer = new IntersectionObserver(onIntersection, {
		// 	root: null, // default is the viewport
		// 	threshold: 0.3 // percentage of target's visible area. Triggers "onIntersection"
		// });
	});

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
					console.debug('PROCESSING ANNOUNCE');
					let note = await wasm?.get_note(String(item.object));
					console.debug('ANNOUNCED NOTE');
					console.debug(note);

					if (note) {
						const n: Note = JSON.parse(note);
						console.debug(n);
						if (item.actor) {
							let actor = parseProfile(await cachedActor(item.actor));
							if (actor) {
								n.ephemeralAnnounces = [actor];
							}
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

	async function loadMore() {
		let url: string | null = null;
		if (next) {
			url = next;
		} else if (prev) {
			url = prev;
		}

		console.debug(`loadMore URL: ${url}`);

		if (url) {
			moreDisabled = true;

			if (local && username) {
				let maxMin = extractMaxMin(url);
				console.debug(`maxMin: ${maxMin}`);
				if (maxMin && maxMin.type && maxMin.value) {
					wasm?.get_outbox(username, maxMin.type, maxMin.value).then((x) => {
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

	function placeOrphans(recursive: boolean) {
		let orphans_copy = new Map(orphans);
		orphans_copy.forEach((orphan, id) => {
			if (orphan.note.inReplyTo) {
				if (notes.has(orphan.note.inReplyTo)) {
					orphans.delete(id);
					placeNote(orphan);
				} else if (recursive && orphans.has(orphan.note.inReplyTo)) {
					placeOrphans(false);
				}
			}
		});
	}

	async function placeNote(displayNote: DisplayNote) {
		const note = displayNote.note;

		// if (note.inReplyTo) {
		// 	// lookup the parent note in the locator to get its traversal path
		// 	let traversal = locator.get(String(note.inReplyTo));

		// 	if (traversal) {
		// 		// set the cursor to the first step in the traversal
		// 		let cursor = notes.get(traversal[0]);

		// 		// traverse through the steps, updating the cursor to find the
		// 		// deepest point
		// 		traversal.forEach((id, key, arr) => {
		// 			if (key > 0) {
		// 				cursor = cursor?.replies.get(id);
		// 			}
		// 		});

		// 		if (cursor?.note.id == note.inReplyTo) {
		// 			// attch this note to its parent
		// 			cursor.replies.set(String(note.id), displayNote);

		// 			// copy the traversal path and add this note's id to the end
		// 			let traversalCopy = [...traversal];
		// 			traversalCopy.push(String(note.id));

		// 			// update the locator map with the traversal path for this note
		// 			locator.set(String(note.id), traversalCopy);
		// 		} else {
		// 			console.error('TRAVERSAL ENDED SOMEWHERE UNEXPECTED');
		// 		}
		// 	} else {
		// 		// we don't have this note's parent yet; queue it for review later
		// 		if (displayNote.note.id) {
		// 			orphans.set(displayNote.note.id, displayNote);
		// 		}
		// 	}
		// } else {
		// this is a top-level note, add it to the notes and locator maps
		//let ap_id = await wasm?.get_ap_id();
		//if (!notes.get(String(note.id)) && actorId && note.attributedTo == actorId) {
		if (!notes.get(String(note.id))) {
			notes.set(String(note.id), displayNote);
			//notes.push(displayNote);
			locator.set(String(note.id), [String(note.id)]);
		}
		//}
	}

	async function addNote(note: Note) {
		console.log('ADDING NOTE');
		console.debug(note);

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

		console.debug(`NOTE ATTRIBUTED_TO: ${note.attributedTo}`);
		let actor: UserProfile | UserProfileTerse | null | undefined =
			note.ephemeralAttributedTo?.at(0);

		if (actor == undefined || actor == null) {
			actor = parseProfile(await cachedActor(note.attributedTo));
		}

		console.debug(`NOTE ACTOR`);
		console.debug(actor);

		if (actor) {
			console.debug('PARSED PROFILE');
			console.debug(actor);
			const displayNote = new DisplayNote(actor, note);

			console.debug('DISPLAY_NOTE');
			console.debug(displayNote);
			await placeNote(displayNote);

			notes = notes;
		}

		//console.log("NOTE ACTOR");
		//console.debug(actor);

		// if (actor) {
		// 	let actorProfile: UserProfile = JSON.parse(actor);
		// 	const displayNote = new DisplayNote(actorProfile, note);

		// 	if (!notes.get(String(note.id))) {
		// 		notes.set(String(note.id), displayNote);
		// 		locator.set(String(note.id), [String(note.id)]);
		// 	}
		// }

		notes = notes;
	}

	async function senderFunction(
		recipientAddress: string | null,
		replyToMessageId: string | null,
		conversationId: string | null,
		content: string,
		attachments: Attachment[]
	): Promise<boolean> {
		if (wasm) {
			let params = (await wasm.SendParams.new()).set_content(content).set_public();

			params = params.set_attachments(JSON.stringify(attachments));

			if (replyToMessageId) {
				params = await params.add_recipient_id(String(recipientAddress), true);
				params = params.set_in_reply_to(String(replyToMessageId));
				params = params.set_conversation(String(conversationId));
			}

			return await wasm.send_note(params);
		} else {
			return false;
		}
	}

	function parseProfile(text: string | null | undefined): UserProfile | null {
		console.debug(`IN parseProfile: ${text}`);

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
			const replyNote = await cachedNote(note.inReplyTo);

			if (replyNote) {
				console.debug(`REPLY_NOTE: ${replyNote}`);
				const note: Note = JSON.parse(String(replyNote));

				//console.debug(`ATTRIBUTED_TO: ${note.attributedTo}`);
				//const reply_actor = await cachedActor(note.attributedTo);
				const replyActor =
					note.ephemeralAttributedTo?.at(0) ?? parseProfile(await cachedActor(note.attributedTo));

				console.debug(`REPLY_ACTOR: ${replyActor}`);
				//const sender: UserProfile | null = parseProfile(reply_actor);

				//console.debug(`SENDER: ${sender}`);

				if (replyActor && wasm) {
					console.debug(`IN replyActor: ${replyActor.name} | ${replyActor.preferredUsername}`);
					const name = insertEmojis(
						wasm,
						replyActor.name ?? replyActor.preferredUsername,
						replyActor
					);

					console.debug(`NAME: ${name}`);
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
			const announceActor = note.ephemeralAnnounces[0];
			let others = '';

			if (note.ephemeralAnnounces.length == 2) {
				others = ` and ${note.ephemeralAnnounces.length - 1} other`;
			} else if (note.ephemeralAnnounces.length > 2) {
				others = ` and ${note.ephemeralAnnounces.length - 1} others`;
			}

			if (announceActor) {
				const name = insertEmojis(
					wasm,
					announceActor.name || announceActor.preferredUsername,
					announceActor
				);

				return <AnnounceParams>{ url: announceActor.url, name, others };
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	async function cachedActor(id: string) {
		if (id && wasm && cache) {
			try {
				console.debug(`RETRIEVING ${id} FROM CACHE`);
				return await wasm.get_actor_cached(cache, id);
			} catch (e) {
				console.error(`FAILED TO RETRIEVE: ${handle}`);
				return null;
			}
		}

		return null;
	}

	async function cachedNote(id: string) {
		console.debug(`RETRIEVING NOTE: ${id}`);

		if (wasm && !apCache.has(id)) {
			apCache.set(id, await wasm.get_note(id));
		}

		return apCache.get(id);
	}

	function handleNoteSelect() {
		console.debug('NOT IMPLEMENTED');
	}

	// controls whether messages from EventSource are immediately displayed or queued
	let liveLoading = true;
	let infiniteScrollDisabled = false;

	// the queue used when the page is not scrolled to the top
	let noteQueue: Note[] = [];

	// ap_id -> [published, note, replies, sender, in_reply_to, conversation]
	$: notes = new Map<string, DisplayNote>();

	// this is a map to locate a note within the nested notes structure;
	// the list is an ordered set of steps to access a note's location
	let locator = new Map<string, string[]>();
	//let orphans: Set<DisplayNote> = new Set<DisplayNote>();
	let orphans: Map<string, DisplayNote> = new Map<string, DisplayNote>();

	// used very temporarily to control requests to the API for new data
	let loading = false;

	// the offset sent to the API for new data; adjusted when Notes are added by EventSource
	let offset = 0;

	// used to reduce calls to the API for Actor data
	let apCache = new Map<string, string | undefined>();
	let cache: any = null;

	let username = $appData.username;

	let focusNote: string | null = null;
	let focusConversation: string | null = null;

	let next: string | null = null;
	let prev: string | null = null;
	let moreDisabled = true;
</script>

{#if wasm}
	<Compose {senderFunction} bind:this={composeComponent} />
{/if}

<main>
	{#if wasm}
		{#each Array.from(notes.values()) as note}
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
							on:replyTo={composeComponent.handleReplyToMessage}
							on:noteSelect={handleNoteSelect}
							renderAction={observeNote}
						/>
					{/await}
				{/await}

				{#if note.note.id == focusNote && note.replies?.size}
					<div class="replies">
						{#each Array.from(note.replies.values()).sort(compare) as reply}
							<Reply
								note={reply}
								{username}
								on:replyTo={composeComponent.handleReplyToMessage}
								on:noteSelect={handleNoteSelect}
							/>
						{/each}
					</div>
				{/if}
			{/if}
		{/each}
		{#if next}
			<button on:click|preventDefault={() => loadMore()} disabled={moreDisabled}
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
