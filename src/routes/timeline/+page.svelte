<script lang="ts">
	import Reply from './components/Reply.svelte';
	import Article from './components/Article.svelte';
	import Compose from './components/Compose.svelte';

	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { appData, enigmatickWasm } from '../../stores';
	import { source } from 'sveltekit-sse';
	import type {
		UserProfile,
		Note,
		StreamConnect,
		Announce,
		AnnounceParams,
		Attachment
	} from '../../common';
	import { insertEmojis, compare, sleep, DisplayNote } from '../../common';

	import { goto } from '$app/navigation';

	let composeComponent: Compose;

	$: wasm = $enigmatickWasm;
	$: avatar = $appData.avatar;

	onMount(async () => {
		const { Buffer } = await import('buffer');
		window.Buffer = Buffer;

		let scrollable = document.getElementsByClassName('scrollable')[0];

		if (scrollable) {
			scrollable.addEventListener('scroll', handleInfiniteScroll);
		}

		if (username) {
			source('/api/user/' + username + '/events', {
				close({ connect }) {
					console.log('event stream closed');
					//connect();
				}
			})
				.select('message')
				.subscribe((message) => {
					if (message) {
						try {
							let e: Note | StreamConnect | Announce = JSON.parse(message);
							console.log(e);

							if ((<Note>e).type === 'Note') {
								if (liveLoading) {
									// display the note immediately
									addNote(<Note>e);
								} else {
									// place the note in the queue to be added when scrolled to the top
									noteQueue.push(<Note>e);
								}

								offset += 1;
							} else if (wasm && (<StreamConnect>e).uuid) {
								wasm.send_authorization((<StreamConnect>e).uuid).then((x: any) => {
									console.info('AUTHORIZATION SENT');
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
				orphans.add(displayNote);
			}
		} else {
			// this is a top-level note, add it to the notes and locator maps
			if (!notes.get(String(note.id))) {
				notes.set(String(note.id), displayNote);
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

				notes = notes;
			}
		}
	}

	async function loadMinimum() {
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
				const results = await loadTimelineData();
				console.debug('TIMELINE LENGTH: ' + results);
				if (results > 0) {
					await loadMinimum();
				}
			} catch (e) {
				console.error(e);
			}
		}
	}

	async function loadTimelineData() {
		const pageSize = 10;

		if (wasm) {
			let view = username ? 'home' : 'global';

			let x = await wasm.get_timeline(offset, pageSize, view);

			try {
				let timeline = JSON.parse(String(x));

				try {
					timeline.forEach((t: Note) => {
						addNote(t);
					});
				} catch (e) {
					console.error(e);
					console.debug(timeline);
				}

				let orphans_copy = new Set(orphans);
				orphans_copy.forEach((orphan) => {
					orphans.delete(orphan);
					placeNote(orphan);
				});

				console.log(locator);
				console.info(orphans);

				offset += pageSize;
				return timeline.length;
			} catch (e) {
				console.error(e);
				console.debug(x);
				// this will stop execution on a parsing error, but the alternative is an infinite loop in the wasm
				// module if the server becomes unavailable
				//throw e;

				// I'm overriding this for now because my proxy seems to be throwing random 502s (probably related
				// to network and NAT configuration) that I haven't taken time to diagnose
				await sleep(1000);
			}
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

	function handleNoteSelect(message: any) {
		console.debug('NOTE SELECT');
		console.debug(message);
		focusConversation = message.detail.conversation;
		focusNote = message.detail.note;

		yPosition = scrollToTop();
		infiniteScrollDisabled = true;
	}

	function clearNoteSelect() {
		focusConversation = null;
		focusNote = null;

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
				results = await loadTimelineData();
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

	async function sender(
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

{#if wasm}
	<Compose {sender} bind:this={composeComponent} />
{/if}

<main>
	{#if wasm}
		<header>
			<nav>
				{#if username}
					<button><i class="fa-solid fa-house" />Home</button>
					<button><i class="fa-solid fa-city" />Local</button>
				{/if}
				<button><i class="fa-solid fa-globe" />Global</button>
			</nav>
		</header>

		<div class="scrollable">
			{#each Array.from(notes.values()).sort(compare).reverse() as note}
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
	{/if}
</main>

<style lang="scss">
	:global(i:hover) {
		cursor: pointer;
		color: red;
	}

	main {
		width: 100%;
		position: relative;
		overflow-y: hidden;
		grid-area: content;
		min-width: 400px;

		@media screen and (max-width: 600px) {
			min-width: unset;
			max-width: unset;
			width: 100vw;
			padding: 0;

			.back {
				top: 5px;
			}
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

			> div {
				grid-area: center;
				display: inline-block;

				a {
					color: darkred;
					text-decoration: none;
				}

				a:visited {
					color: darkred;
				}

				a:hover {
					color: red;
					text-decoration: none;
				}
			}

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
					color: #aaaaaa;
					background: none;
					border: 0;
				}

				button:hover {
					color: red;
					cursor: pointer;
				}

				button > i {
					padding: 0 5px;
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

			@media screen and (max-width: 600px) {
				padding: 0;
			}
		}

		.back {
			position: absolute;
			left: 10px;
			top: 7px;
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
		}

		a {
			color: darkgoldenrod;
		}

		a:hover {
			color: red;
		}

		header {
			background: #000;
			border-bottom: 1px solid #222;

			a {
				color: whitesmoke;
			}
		}
	}
</style>
