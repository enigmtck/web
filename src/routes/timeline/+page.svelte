<script lang="ts">
	import Reply from './components/Reply.svelte';
	import Article from './components/Article.svelte';
	import Compose from './components/Compose.svelte';

	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { appData, enigmatickWasm, wasmState } from '../../stores';
	import { source } from 'sveltekit-sse';
	import type {
		UserProfile,
		Note,
		StreamConnect,
		Announce,
		AnnounceParams,
		Attachment,
		Activity,
		Collection
	} from '../../common';
	import { insertEmojis, compare, sleep, DisplayNote, extractMaxMin } from '../../common';

	import { goto } from '$app/navigation';
	import type { ComposeDispatch } from './components/common';

	let composeComponent: Compose;
	$: view = '';

	$: wasm = $enigmatickWasm;
	$: avatar = $appData.avatar;

	let streamUuid: string | null = null;
	let observer: IntersectionObserver | null = null;
	let retrievedConversations: Set<string> = new Set();
	let currentIds: Array<string> = new Array();

	function onIntersection(entries: IntersectionObserverEntry[]) {
		for (let entry of entries) {
			if (entry.target) {
				let target = <HTMLElement>entry.target;
				if (entry.isIntersecting) {
					currentIds.push(target.id);

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

	function observeNote(note: any) {
		if (observer) {
			observer.observe(note);
		}
	}

	onMount(async () => {
		const { Buffer } = await import('buffer');
		window.Buffer = Buffer;

		let scrollable = document.getElementsByClassName('scrollable')[0];
		observer = new IntersectionObserver(onIntersection, {
			root: null, // default is the viewport
			threshold: 0.3 // percentage of target's visible area. Triggers "onIntersection"
		});

		if (scrollable) {
			scrollable.addEventListener('scroll', handleInfiniteScroll);
		}

		if (username) {
			view = 'home';

			source('/api/user/' + username + '/events', {
				close({ connect }) {
					console.log('event stream closed');
					sleep(500).then(() => {
						connect();
					});
				}
			})
				.select('message')
				.subscribe((message) => {
					if (message) {
						try {
							let e: Note | StreamConnect | Announce = JSON.parse(message);
							console.log(e);

							if ((<Note>e).type === 'Note') {
								let note = <Note>e;
								if (liveLoading || note.inReplyTo) {
									// display the note immediately
									addNote(note);
								} else {
									// place the note in the queue to be added when scrolled to the top
									noteQueue.push(note);
								}

								offset += 1;
							} else if (wasm && (<StreamConnect>e).uuid) {
								streamUuid = (<StreamConnect>e).uuid;
								wasm.send_authorization(streamUuid).then((x: any) => {
									console.info(`AUTHORIZATION SENT FOR ${streamUuid}`);
								});
							} else if (wasm && (<Announce>e).type == 'Announce') {
								let announce = <Announce>e;
								wasm.get_note(announce.object).then((x: any) => {
									try {
										let note: Note = JSON.parse(String(x));
										note.ephemeralAnnounces = [announce.actor];
										note.id = announce.id;
										note.published = announce.published;
										note.ephemeralTimestamp = announce.published;

										if (liveLoading) {
											addNote(note);
										} else {
											noteQueue.push(note);
										}

										offset += 1;
									} catch (e) {
										console.error('FAILED TO ADD NOTE');
										console.error(x);
									}
								});
							}
						} catch (e) {
							console.error('FAILED TO PARSE SSE MESSAGE');
							console.error(message);
						}
					}
				});
		} else {
			view = 'global';
		}
	});

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

				if (sender && wasm) {
					const name = insertEmojis(wasm, sender.name || sender.preferredUsername, sender);

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
			console.log('EPHEMERAL ANNOUNCES');
			console.debug(note.ephemeralAnnounces);

			const announce_actor = await cachedActor(note.ephemeralAnnounces[0]);
			let others = '';

			if (note.ephemeralAnnounces.length == 2) {
				others = ` and ${note.ephemeralAnnounces.length - 1} other`;
			} else if (note.ephemeralAnnounces.length > 2) {
				others = ` and ${note.ephemeralAnnounces.length - 1} others`;
			}

			if (announce_actor) {
				const announce_profile: UserProfile | null = parseProfile(announce_actor);

				if (announce_profile && wasm) {
					const name = insertEmojis(
						wasm,
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

	function placeNote(displayNote: DisplayNote) {
		const note = displayNote.note;

		if (note.inReplyTo) {
			// lookup the parent note in the locator to get its traversal path
			let traversal = locator.get(String(note.inReplyTo));

			if (traversal) {
				// set the cursor to the first step in the traversal
				let cursor = notes.get(traversal[0]);

				// traverse through the steps, updating the cursor to find the
				// deepest point
				traversal.forEach((id, key, arr) => {
					if (key > 0) {
						cursor = cursor?.replies.get(id);
					}
				});

				if (cursor?.note.id == note.inReplyTo) {
					// attch this note to its parent
					cursor.replies.set(String(note.id), displayNote);

					// copy the traversal path and add this note's id to the end
					let traversalCopy = [...traversal];
					traversalCopy.push(String(note.id));

					// update the locator map with the traversal path for this note
					locator.set(String(note.id), traversalCopy);
				} else {
					console.error('TRAVERSAL ENDED SOMEWHERE UNEXPECTED');
				}
			} else {
				// we don't have this note's parent yet; queue it for review later
				if (displayNote.note.id) {
					orphans.set(displayNote.note.id, displayNote);
				}
			}
		} else {
			// this is a top-level note, add it to the notes and locator maps
			if (!notes.get(String(note.id))) {
				notes.set(String(note.id), displayNote);
				//notes.push(displayNote);
				locator.set(String(note.id), [String(note.id)]);
			}
		}
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

		if (note.attributedTo) {
			const actor = await cachedActor(note.attributedTo);

			if (actor) {
				const profile: UserProfile | null = parseProfile(actor);

				if (profile) {
					const displayNote = new DisplayNote(profile, note);
					placeNote(displayNote);
				}

				//notesMap = notesMap;
				notes = notes;
			}
		}
	}

	function loadMinimum() {
		let topLevel = 0;

		notes.forEach((note) => {
			if (!note.note.inReplyTo) {
				topLevel += 1;
			}
		});

		if (topLevel < 10) {
			try {
				// if loadTimelineData returns 0, that means it's reached the end
				// of what is available and we should stop
				loadTimelineData().then((results) => {
					console.debug('TIMELINE LENGTH: ' + results);
					if (results && results > 0) {
						loadMinimum();
					}
				});
			} catch (e) {
				console.error(e);
			}
		}
	}

	async function loadTimelineData() {
		const pageSize = 10;
		let attempts = 0;

		if (wasm && view) {
			if (!cache) {
				cache = new wasm.EnigmatickCache();
			}

			let x = await wasm.get_timeline(maxValue, undefined, pageSize, view);
			console.debug('WASM RESPONSE');

			try {
				let collection: Collection = JSON.parse(String(x));
				console.debug(collection);

				if (collection.next) {
					const result = extractMaxMin(collection.next);

					if (result.type === 'max' && result.value) {
						maxValue = result.value;
					}
				}

				let scrollable = document.getElementsByClassName('scrollable')[0];
				let beforeScroll = scrollable.scrollTop;
				console.log(`SCROLL TOP ${beforeScroll}`);

				try {
					collection.orderedItems?.forEach((a: Activity) => {
						console.debug(a);
						addNote(a.object);
					});
				} catch (e) {
					console.error(e);
					console.debug(collection);
				}

				let l: number = collection.orderedItems?.length ?? 0;
				if (l > 0 && beforeScroll) {
					scrollable.scrollTop = beforeScroll;
					console.log(`SCROLLED ${scrollable.scrollTop}`);
				}

				placeOrphans(true);

				console.log(locator);
				console.info(orphans);

				offset += pageSize;
				return length;
			} catch (e) {
				console.error(e);
				console.debug(x);
				// this will stop execution on a parsing error, but the alternative is an infinite loop in the wasm
				// module if the server becomes unavailable
				//throw e;

				// I'm overriding this for now because my proxy seems to be throwing random 502s (probably related
				// to network and NAT configuration) that I haven't taken time to diagnose
				while (attempts++ < 10) {
					await sleep(1000);
					await loadTimelineData();
					console.debug('RETRYING TIMELINE');
				}
			}
		} else {
			console.error('NO WASM OR VIEW YET');
			await sleep(500);
			await loadTimelineData();
		}
	}

	beforeNavigate((navigation) => {
		// this is currently triggered (and not reset) when opening a link in to a new tab. this is likely a bug
		// and may be addressed here: https://github.com/sveltejs/kit/issues/8482
		// UPDATE - ran a 'yarn upgrade' and this seems to be fixed now
		console.log(navigation);
		if (navigation.to) {
			if (navigation.to.route.id === null) {
				let actor = navigation.to.url.href;

				// we want to catch the calls to external profiles so that we can offer actions on them; the
				// intention of this expression is to match Mastodon-isms like (with grouping notated)
				// ^https://(ser)(.endipito)(.us)/@justin$ or ^https://(infosec)(.exchange)/@jdt$
				const re = /^https:\/\/(:?[a-zA-Z0-9\-]+)(:?\.[a-zA-Z0-9\-]+)+?\/@[a-zA-Z0-9_]+$/;

				if (actor.match(re)) {
					console.log(actor);
					navigation.cancel();
					goto(`/search?actor=${actor}`);
				}
			}
		}
	});

	async function handleView(event: Event) {
		console.log(event);
		if (event.target) {
			let selected = (<HTMLElement>event.target).dataset.view;
			if (selected) {
				Array.from(
					document
						.getElementsByTagName('header')[0]
						.getElementsByTagName('nav')[0]
						.getElementsByTagName('button')
				).forEach((x) => x.classList.remove('selected'));

				(<HTMLElement>event.target).classList.add('selected');

				view = selected;
				resetData();
				await loadMinimum();
			}
		}
	}

	function handleNoteSelect(message: CustomEvent<ComposeDispatch>) {
		console.debug('NOTE SELECT');
		console.debug(message);
		focusConversation = message.detail.replyToConversation;
		focusNote = message.detail.replyToNote;
		console.debug(`setting focusNote to ${message.detail.replyToNote}`);

		yPosition = scrollToTop();
		infiniteScrollDisabled = true;

		// this doesn't seem to work
		console.debug('MESSAGE DETAIL');
		console.debug(message.detail);
		composeComponent.handleReplyToMessage({
			detail: message.detail
		});
	}

	function clearNoteSelect() {
		focusConversation = null;
		focusNote = null;
		composeComponent.resetCompose();

		sleep(500).then(() => {
			const main = document.getElementsByTagName('main')[0];
			main.scrollTop = yPosition;
		});

		infiniteScrollDisabled = false;
	}

	function scrollToTop(): number {
		const scrollable = document.getElementsByClassName('scrollable')[0];
		let current: number = scrollable.scrollTop;
		scrollable.scrollTop = 0;

		return current;
	}

	async function handleInfiniteScroll() {
		const scrollable = document.getElementsByClassName('scrollable')[0] as HTMLElement;

		if (!loading && !infiniteScrollDisabled) {
			loading = true;

			let results = 1;
			while (
				!infiniteScrollDisabled &&
				scrollable.scrollTop + scrollable.offsetHeight >= scrollable.scrollHeight * 0.8 &&
				results > 0
			) {
				results = (await loadTimelineData()) || 0;
			}

			loading = false;
		}

		const scroll = document.getElementsByClassName('scroll')[0] as HTMLElement;
		if (scrollable.scrollTop < 50) {
			liveLoading = true;

			let note;
			while ((note = noteQueue.shift()) !== undefined) {
				addNote(note);
			}

			scroll.style.display = 'none';
		} else {
			liveLoading = false;
			scroll.style.display = 'revert';
		}
	}

	async function cachedActor(id: string) {
		if (id && wasm && cache) {
			try {
				console.debug(`RETRIEVING ${id} FROM CACHE`);
				return await wasm.get_actor_cached(cache, id);
			} catch (e) {
				console.error(`FAILED TO RETRIEVE: ${id}`);
				return null;
			}
		}

		return null;
	}

	async function cachedNote(id: string) {
		if (wasm && !apCache.has(id)) {
			apCache.set(id, await wasm.get_note(id));
		}

		return apCache.get(id);
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

	function refresh() {
		console.debug('REFRESH');
	}

	function remove() {
		console.debug('REMOVE');
	}

	function resetData() {
		noteQueue = [];
		locator = new Map<string, string[]>();
		orphans = new Map<string, DisplayNote>();
		offset = 0;
		notes = new Map<string, DisplayNote>();
		//notes = new Array<DisplayNote>();
		retrievedConversations = new Set();
		yPosition = scrollToTop();
		maxValue = undefined;
		minValue = undefined;

		const scroll = document.getElementsByClassName('scroll')[0] as HTMLElement;
		scroll.style.display = 'none';
	}

	let cache: any = null;

	// controls whether messages from EventSource are immediately displayed or queued
	let liveLoading = true;
	let infiniteScrollDisabled = false;

	// the queue used when the page is not scrolled to the top
	let noteQueue: Note[] = [];

	// HTML formatted notes to display in the Timeline
	//$: notes = new Array<DisplayNote>();
	// ap_id -> [published, note, replies, sender, in_reply_to, conversation]
	$: notes = new Map<string, DisplayNote>();

	// this is a map to locate a note within the nested notes structure;
	// the list is an ordered set of steps to access a note's location
	let locator = new Map<string, string[]>();
	let orphans: Map<string, DisplayNote> = new Map<string, DisplayNote>();

	// used very temporarily to control requests to the API for new data
	let loading = false;

	// the offset sent to the API for new data; adjusted when Notes are added by EventSource
	let offset = 0;
	let maxValue: string | undefined = undefined;
	let minValue: string | undefined = undefined;

	// used to reduce calls to the API for Actor data
	let apCache = new Map<string, string | undefined>();

	let username = $appData.username;

	let focusNote: string | null = null;
	let focusConversation: string | null = null;

	let yPosition: number = 0;

	$: if (wasm) {
		loadMinimum();
	}

	function isDark() {
		let body = document.getElementsByTagName('body')[0];
		if (body && body.classList.contains('dark')) {
			return true;
		} else {
			return false;
		}
	}

	function setDark() {
		let body = document.getElementsByTagName('body')[0];
		let control = document.getElementById('theme') as HTMLInputElement | null;
		if (body && !body.classList.contains('dark')) {
			body.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		}

		if (control) {
			control.checked = false;
		}
	}

	function setLight() {
		let body = document.getElementsByTagName('body')[0];
		let control = document.getElementById('theme') as HTMLInputElement | null;
		if (body && body.classList.contains('dark')) {
			body.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}

		if (control) {
			control.checked = true;
		}
	}

	function darkMode(event: any) {
		if (isDark()) {
			setLight();
		} else {
			setDark();
		}
	}
</script>

<Compose {senderFunction} bind:this={composeComponent} />

<main>
	<header>
		<nav>
			{#if username}
				<button class="selected" data-view="home" on:click={handleView}
					><i class="fa-solid fa-house" />Home</button
				>
				<button data-view="local" on:click={handleView}><i class="fa-solid fa-city" />Local</button>
			{/if}
			<button data-view="global" on:click={handleView}><i class="fa-solid fa-globe" />Global</button
			>
		</nav>
	</header>

	<div class="scrollable">
		{#each Array.from(notes.values()) as note}
			{#if note.note && ((!focusNote && (!note.note.inReplyTo || note.note.ephemeralAnnounces?.length)) || note.note.id == focusNote)}
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
	</div>

	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="scroll" on:click={scrollToTop}>
		<i class="fa-solid fa-chevron-up" />
	</div>

	{#if focusNote || focusConversation}
		<div class="back">
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<i class="fa-solid fa-angles-left" on:click|preventDefault={clearNoteSelect} />
		</div>
	{/if}
</main>

<style lang="scss">
	main {
		width: 100%;
		position: relative;
		overflow-y: hidden;
		grid-area: content;
		min-width: 400px;

		@media screen and (max-width: 700px) {
			min-width: unset;
			max-width: unset;
			width: 100vw;
			padding: 0;
		}

		header {
			z-index: 25;
			padding: 0;
			position: relative;
			width: 100%;
			height: 41px;
			background: #eee;
			color: darkred;
			text-align: center;
			font-family: 'Open Sans';
			font-size: 22px;
			font-weight: 600;
			grid-area: header;
			display: grid;
			grid-template-columns: auto auto auto;
			grid-template-areas: 'left center right';
			align-items: center;

			nav {
				grid-area: center;
				display: flex;
				flex-direction: row;
				align-items: center;
				margin: 0;
				width: 100%;

				button {
					display: inline-block;
					width: 100%;
					text-decoration: none;
					font-family: 'Open Sans';
					font-size: 14px;
					padding: 5px;
					margin: 0 5px;
					color: #eee;
					background: none;
					border: 0;
					border-radius: 20px;
				}

				:global(.selected) {
					background: #222 !important;
				}

				button:hover {
					cursor: pointer;
				}

				button > i {
					padding: 0 5px;
					pointer-events: none;
				}
			}
		}

		div.scrollable {
			overflow-y: auto;
			height: calc(100% - 41px);
			scroll-behavior: smooth;
			padding: 0 10px;

			.replies {
				padding-bottom: 60px;
				display: flex;
				flex-direction: column;
				align-items: center;
			}

			@media screen and (max-width: 700px) {
				padding: 0;
			}
		}

		.back {
			position: absolute;
			left: 10px;
			top: 5px;
			width: 50px;
			text-align: center;
			border-radius: 10px;
			font-size: 28px;
			color: #777;
			opacity: 0.6;
			transition-duration: 1s;
			z-index: 31;
		}

		.back:hover {
			opacity: 1;
			color: red;
			transition-duration: 1s;
			cursor: pointer;
		}

		.scroll {
			display: none;
			position: absolute;
			left: calc(50% - 80px);
			width: 160px;
			top: 44px;
			padding-top: 2px;
			opacity: 0.5;
			background: darkred;
			text-align: center;
			border-radius: 15px;
			font-size: 26px;
			color: white;
			border: 0;
			transition-duration: 1s;
			z-index: 25;

			i {
				pointer-events: none;
			}
		}

		.scroll:hover {
			opacity: 1;
			cursor: pointer;
			transition-duration: 1s;
		}
	}

	:global(body.dark) {
		main {
			background: #000;
			header {
				background: #000;
				border-bottom: 1px solid #222;
			}
		}
	}
</style>
