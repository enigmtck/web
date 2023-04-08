<script lang="ts">
	import { page } from '$app/stores';
	import Reply from './components/Reply.svelte';
	import Article from './components/Article.svelte';

	import { onDestroy, onMount, setContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import { Converter } from 'showdown';
	import showdownHighlight from 'showdown-highlight';
	import type { UserProfile, Note, StreamConnect, Announce, AnnounceParams } from '../../common';
	import { insertEmojis, compare } from '../../common';

	import { goto } from '$app/navigation';

	function sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	let getNote: any;
	let sendNote: any;
	let getActor: any;
	let getTimeline: any;
	let sendLike: any;
	let sendAnnounce: any;
	let sendAuthorization: any;

	let enigmatickWasm: any;

	let eventSource: EventSource | null = null;

	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
		}
	});

	onMount(() => {
		let main = document.getElementsByTagName('main')[0];
		main.addEventListener('scroll', handleInfiniteScroll);

		import('enigmatick_wasm').then((enigmatick_wasm) => {
			enigmatick_wasm.default().then(() => {
				enigmatickWasm = enigmatick_wasm;

				getNote = enigmatick_wasm.get_note;
				sendNote = enigmatick_wasm.send_note;
				getActor = enigmatick_wasm.get_actor;
				getTimeline = enigmatick_wasm.get_timeline;
				sendLike = enigmatick_wasm.send_like;
				sendAnnounce = enigmatick_wasm.send_announce;
				sendAuthorization = enigmatick_wasm.send_authorization;

				enigmatick_wasm.load_instance_information().then((instance) => {
					console.log(instance?.domain);
					console.log(instance?.url);

					if (get(wasmState)) {
						enigmatick_wasm.import_state(get(wasmState));
						console.log('loaded state from store');
					}

					loadMinimum();

					if (username && !eventSource) {
						if (!eventSource) {
							eventSource = new EventSource('/api/user/' + username + '/events');

							function onMessage(event: any) {
								console.log('event: ' + event.data);
								let e: Note | StreamConnect | Announce = JSON.parse(event.data);
								console.log(e);

								if ((<Note>e).type === 'Note') {
									if (live_loading) {
										// display the note immediately
										addNote(<Note>e);
									} else {
										// place the note in the queue to be added when scrolled to the top
										note_queue.push(<Note>e);
									}

									offset += 1;
								} else if ((<StreamConnect>e).uuid) {
									sendAuthorization((<StreamConnect>e).uuid).then((x: any) => {
										console.info('AUTHORIZATION SENT');
									});
								} else if ((<Announce>e).type == 'Announce') {
									let announce = <Announce>e;
									getNote(announce.object).then((x: any) => {
										try {
											let note: Note = JSON.parse(String(x));
											note.ephemeralAnnounces = [announce.actor];
											note.id = announce.id;
											note.published = announce.published;
											note.ephemeralTimestamp = announce.published;

											if (live_loading) {
												addNote(note);
											} else {
												note_queue.push(note);
											}

											offset += 1;
										} catch (e) {
											console.error('FAILED TO ADD NOTE');
											console.error(x);
										}
									});
								}
							}

							function restartEventSource(event: any) {
								console.log(event);

								if (eventSource && eventSource.readyState == 2) {
									sleep(2000).then(() => {
										eventSource = new EventSource('/api/user/' + username + '/events');
										eventSource.onerror = restartEventSource;
										eventSource.onmessage = onMessage;
									});
								}
							}

							eventSource.onerror = restartEventSource;
							eventSource.onmessage = onMessage;

							return () => {
								if (eventSource && eventSource.readyState === 1) {
									eventSource.close();
								}
							};
						}
					}
				});
			});
		});
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
					ap_cache.set(actor.id, JSON.stringify(actor));
				}
			});
		}

		if (note.attributedTo) {
			const actor = await cachedActor(note.attributedTo);

			if (actor) {
				const profile: UserProfile | null = parseProfile(actor);

				if (profile) {
					let icon = '';

					if (profile.icon) {
						icon = `<img src="${profile.icon.url}" />`;
					}

					const displayNote = new DisplayNote(profile, note);
					placeNote(displayNote);
				}

				notes = notes;
			}
		}
	}

	class DisplayNote {
		note: Note;
		actor: UserProfile;
		published: string;
		replies: Map<string, DisplayNote>;

		constructor(profile: UserProfile, note: Note, replies?: Map<string, DisplayNote>) {
			this.note = note;
			this.actor = profile;
			this.published = String(note.ephemeralTimestamp);
			this.replies = replies || new Map<string, DisplayNote>();
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

		let x = await getTimeline(offset, pageSize);

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
			throw e;
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

	function handleComposeSubmit(event: any) {
		console.log(event);
	}

	function convertToHtml(data: string) {
		let converter = new Converter({
			extensions: [
				showdownHighlight({
					pre: true,
					auto_detection: true
				})
			]
		});
		converter.setFlavor('vanilla');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeHtml(data);
	}

	function captureChanges() {
		let compose = document.getElementById('compose');

		if (compose) {
			markdown_note = compose.innerText;
			html_note = convertToHtml(markdown_note);
		}
	}

	function handlePreview() {
		captureChanges();

		preview = !preview;
	}

	function resetCompose() {
		let compose;
		if ((compose = document.getElementById('compose'))) {
			compose.innerText = '';
		}

		cancelReplyTo();
		preview = false;
		markdown_note = '';
		html_note = '';
	}

	function handleAnnounce(message: any) {
		console.debug('HANDLING DISPATCHED ANNOUNCE');
		const object: string | null | undefined = message.detail.object;
		const actor: string | null | undefined = message.detail.actor;

		if (object && actor) {
			sendAnnounce(actor, object).then(() => {
				// this will only work for top-level notes
				let note = notes.get(object);
				if (note) {
					//note.note.ephemeralAnnounced = true;
				}
			});
		} else {
			console.error('OBJECT OR ACTOR INVALID');
			console.debug(`OBJECT: ${object}, ACTOR: ${actor}`);
		}
	}

	function handleLike(message: any) {
		console.debug('HANDLING DISPATCHED LIKE');
		const object: string = String(message.detail.object);
		const actor: string = String(message.detail.actor);

		sendLike(actor, object).then(() => {
			// this will only work for top-level notes
			let note = notes.get(object);
			if (note) {
				note.note.ephemeralLiked = true;
			}
		});
	}

	function handleUnlike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);
	}

	async function handlePublish() {
		captureChanges();

		let params = (await enigmatickWasm.SendParams.new()).set_content(html_note).set_public();

		if (reply_to_note) {
			params = await params.add_recipient_id(String(reply_to_recipient), true);
			params = params.set_in_reply_to(String(reply_to_note));
			params = params.set_conversation(String(reply_to_conversation));
		}

		//console.log(params.export());

		sendNote(params).then((x: any) => {
			if (x) {
				resetCompose();
				closeAside();
				console.log('send successful');
			} else {
				console.log('send unsuccessful');
			}
		});
	}

	function escapeMarkdown(text: string) {
		text = text.replaceAll('_', '\\_').replaceAll('*', '\\*');

		return text;
	}

	function handleNoteSelect(message: any) {
		focus_conversation = message.detail.conversation;
		focus_note = message.detail.note;

		y_position = scrollToTop();
		infinite_scroll_disabled = true;
	}

	function clearNoteSelect() {
		focus_conversation = null;
		focus_note = null;

		sleep(500).then(() => {
			const main = document.getElementsByTagName('main')[0];
			main.scrollTop = y_position;
		});

		infinite_scroll_disabled = false;
	}

	async function handleReplyToMessage(message: any) {
		console.log(message);

		reply_to_recipient = message.detail.reply_to_recipient;
		reply_to_note = message.detail.reply_to_note;
		reply_to_display = message.detail.reply_to_display;
		reply_to_conversation = message.detail.reply_to_conversation;

		const reply_to_url = message.detail.reply_to_url;
		const reply_to_username = message.detail.reply_to_username;

		//const webfinger_acct = await get_webfinger_from_id(String(reply_to_recipient));
		markdown_note = `<span class="h-card"><a href="${reply_to_url}" class="u-url mention" rel="noopener noreferrer">@${reply_to_username}</a></span> `;
		html_note = convertToHtml(markdown_note);

		openAside();
	}

	function cancelReplyTo() {
		reply_to_note = null;
		reply_to_display = null;
		reply_to_conversation = null;
		reply_to_recipient = null;
		markdown_note = '';
	}

	function scrollToTop(): number {
		const main = document.getElementsByTagName('main')[0];
		let current: number = main.scrollTop;
		main.scrollTop = 0;

		return current;
	}

	async function handleInfiniteScroll() {
		const main = document.getElementsByTagName('main')[0];

		if (!loading && !infinite_scroll_disabled) {
			loading = true;

			let results = 1;
			while (
				!infinite_scroll_disabled &&
				main.scrollTop + main.offsetHeight >= main.scrollHeight * 0.7 &&
				results > 0
			) {
				results = await loadTimelineData();
			}

			loading = false;
		}

		const scroll = document.getElementsByClassName('scroll')[0] as HTMLElement;
		if (main.scrollTop < 50) {
			live_loading = true;

			let note;
			while ((note = note_queue.shift()) !== undefined) {
				addNote(note);
			}

			scroll.style.display = 'none';
		} else {
			live_loading = false;
			scroll.style.display = 'revert';
		}
	}

	async function cachedActor(id: string) {
		if (!ap_cache.has(id)) {
			ap_cache.set(id, await getActor(id));
		}

		return ap_cache.get(id);
	}

	async function cachedNote(id: string) {
		if (!ap_cache.has(id)) {
			ap_cache.set(id, await getNote(id));
		}

		return ap_cache.get(id);
	}

	function closeAside() {
		cancelReplyTo();
		const dialog = document.getElementsByTagName('dialog')[0];
		dialog.close();

		const mask = document.getElementsByClassName('mask')[0];
		mask.classList.add('closed');
	}

	function openAside() {
		const dialog = document.getElementsByTagName('dialog')[0];
		dialog.showModal();

		const mask = document.getElementsByClassName('mask')[0];
		mask.classList.remove('closed');
	}

	// controls whether messages from EventSource are immediately displayed or queued
	let live_loading = true;
	let infinite_scroll_disabled = false;

	// the queue used when the page is not scrolled to the top
	let note_queue: Note[] = [];

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
	let ap_cache = new Map<string, string | undefined>();

	let profile: UserProfile | null = null;
	let username = get(appData).username;
	let display_name = get(appData).display_name;

	let markdown_note = '';
	let html_note = '';
	let preview = false;

	let reply_to_recipient: string | null = null;
	let reply_to_note: string | null = null;
	let reply_to_display: string | null = null;
	let reply_to_conversation: string | null = null;

	let focus_note: string | null = null;
	let focus_conversation: string | null = null;

	let y_position: number = 0;
</script>

<div class="mask closed" />

<dialog>
	{#if username}
		<div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<i class="fa-solid fa-xmark" on:click={closeAside} />
			{#if reply_to_display}
				<span
					>Replying to {reply_to_display}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i class="fa-solid fa-xmark" on:click={cancelReplyTo} /></span
				>
			{/if}
			{#if !preview}
				<pre id="compose" contenteditable="true">{markdown_note}</pre>
			{:else}
				<div>{@html html_note}</div>
			{/if}

			<form method="POST" on:submit|preventDefault={handleComposeSubmit}>
				<i class="fa-solid fa-paperclip" />
				{#if preview}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i class="fa-solid fa-pen-nib" on:click|preventDefault={handlePreview} />
				{:else}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i class="fa-solid fa-eye" on:click|preventDefault={handlePreview} />
				{/if}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i class="fa-regular fa-paper-plane" on:click|preventDefault={handlePublish} />
			</form>
		</div>
	{/if}
</dialog>

<main>
	{#each Array.from(notes.values()).sort(compare).reverse() as note}
		{#if note.note && ((!focus_note && (!note.note.inReplyTo || note.note.ephemeralAnnounces?.length)) || note.note.id == focus_note)}
			{#await replyToHeader(note.note) then replyTo}
				{#await announceHeader(note.note) then announce}
					<Article
						{note}
						{username}
						replyToHeader={replyTo}
						announceHeader={announce}
						on:reply_to={handleReplyToMessage}
						on:note_select={handleNoteSelect}
						on:like={handleLike}
						on:announce={handleAnnounce}
					/>
				{/await}
			{/await}

			{#if note.note.id == focus_note && note.replies?.size}
				<div class="replies">
					{#each Array.from(note.replies.values()).sort(compare) as reply}
						<Reply
							note={reply}
							{username}
							on:reply_to={handleReplyToMessage}
							on:note_select={handleNoteSelect}
							on:like={handleLike}
							on:announce={handleAnnounce}
						/>
					{/each}
				</div>
			{/if}
		{/if}
	{/each}

	{#if username}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div class="compose" on:click={openAside}>
			<i class="fa-solid fa-pencil" />
		</div>
	{/if}

	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="scroll"
		on:click={() => {
			let main = document.getElementsByTagName('main')[0];
			main.scrollTo(0, 0);
		}}
	>
		<i class="fa-solid fa-square-caret-up" />
	</div>

	{#if focus_note || focus_conversation}
		<div class="back">
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<i class="fa-solid fa-angles-left" on:click|preventDefault={clearNoteSelect} />
		</div>
	{/if}
</main>

<style lang="scss">
	:global(i:hover) {
		cursor: pointer;
		color: red;
	}

	.mask {
		background: #999;
		opacity: 0.9;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		z-index: 25;
		pointer-events: all;
	}

	.closed {
		display: none;
	}

	dialog {
		margin: 0;
		position: fixed;
		min-height: 220px;
		min-width: 400px;
		max-height: 100%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 30;
		text-align: unset;
		padding: 0;
		border: 0;
		border-radius: 10px;

		div {
			position: relative;
			display: block;
			height: 100%;
			width: 100%;
			margin: 0;
			padding: 25px 10px 0 10px;
			border-radius: 10px;
			background: #ddd;

			> i {
				position: absolute;
				right: 10px;
				top: 5px;
			}

			> span {
				display: inline-block;
				background: #efefef;
				border: 1px solid #ccc;
				padding: 4px;
				margin: 5px 0;
				font-family: 'Open Sans';
			}

			pre,
			div {
				position: relative;
				text-align: left;
				width: 100%;
				padding: 10px;
				margin: 0;
				background: white;
				min-height: 150px;
				max-height: 80vh;
				border: 1px solid #eee;
				font-family: 'Open Sans';
				border-radius: 10px;
				word-wrap: break-word;
				overflow: scroll;
			}

			div {
				padding: 0 10px;
			}

			form {
				display: flex;
				justify-content: space-evenly;
				align-items: center;

				i {
					font-size: 24px;
					padding: 10px;
				}

				i:hover {
					cursor: pointer;
					color: red;
				}

				button {
					display: inline-block;
					margin: 5px;
					padding: 5px 15px;
					background: darkred;
					color: whitesmoke;
					border: 0;
					font-family: 'Open Sans';
					font-size: 18px;
					font-weight: 600;
				}

				button:hover {
					color: darkred;
					background: whitesmoke;
					cursor: pointer;
				}
			}
		}

		@media screen and (max-width: 600px) {
			top: 0;
			left: 0;
			width: 100vw;
			max-width: unset;
			max-height: unset;
			margin: 0;
			height: 100%;
			z-index: 21;
			text-align: unset;
			background: #ddd;
			border-radius: unset;
			transform: unset;

			.mask {
				display: none;
			}

			div {
				position: relative;
				display: block;
				margin: 0;
				padding: 0;
				border: 0;
				border-radius: 0;
				height: 100%;
				width: 100%;
				max-height: unset;
				min-height: unset;
				padding-top: 35px;
				max-width: unset;
				min-width: unset;

				> i {
					font-size: 28px;
					color: #222;
				}

				> i:hover {
					color: red;
				}

				span {
					position: fixed;
					top: 10px;
					left: 10px;
					z-index: 30;
					opacity: 0.7;
				}

				pre,
				div {
					position: relative;
					display: block;
					height: calc(100% - 60px);
					width: calc(100vw - 12px);
					margin: 5px;
					border-radius: 0;
					border: 1px solid #aaa;
					max-height: unset;
					min-height: unset;
				}

				form {
					display: flex;
					justify-content: space-evenly;
					position: relative;
					width: 100%;
					bottom: 0;
					left: 0;
					border: 0;
					height: 50px;
					background: #ddd;

					button {
						position: fixed;
						top: 40px;
						right: 10px;
						border-radius: 5px;
					}
				}
			}
		}
	}

	@media screen and (max-width: 600px) {
		:global(.closed) {
			display: none;
		}
	}

	:global(body.dark) {
		dialog {
			background: #444;

			div {
				background: #444;

				span {
					background: #555;
					color: white;
					border: 1px solid #333;
				}

				pre,
				div {
					background: #333;
					color: white;
					border: 1px solid #777;
				}

				> i {
					color: #ccc;
				}

				> i:hover {
					color: red;
				}
			}

			.mask {
				background: black;
			}

			form {
				background: #444;

				i {
					color: #ccc;
				}

				i:hover {
					color: red;
				}
			}
		}
	}

	main {
		position: relative;
		width: 100%;
		height: calc(100vh - 42px);
		overflow-y: auto;

		.compose {
			display: flex;
			justify-content: center;
			align-items: center;
			position: fixed;
			right: calc(50% - 30px);
			bottom: 10px;
			background: #eee;
			width: 60px;
			height: 60px;
			border-radius: 10px;
			opacity: 0.9;
			border: 1px solid #ccc;
			color: #444;
			transition-duration: 1s;

			i {
				font-size: 24px;
			}
		}

		.compose:hover {
			cursor: pointer;
			color: red;
			opacity: 1;
			transition-duration: 1s;
		}

		.back {
			position: fixed;
			left: 10px;
			top: 50px;
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
			position: fixed;
			left: calc(50% - 50px);
			width: 100px;
			top: 50px;
			background: #ddd;
			text-align: center;
			border-radius: 10px;
			font-size: 28px;
			color: #777;
			opacity: 0.3;
			border: 1px solid #bbb;
			transition-duration: 1s;
		}

		.scroll:hover {
			opacity: 0.8;
			color: red;
			cursor: pointer;
			transition-duration: 1s;
		}

		:global(header) {
			display: flex;
			flex-direction: row;
			width: 100%;

			:global(div) {
				display: inline-block;
				width: calc(100% - 55px);
			}

			:global(div:first-child) {
				width: 55px;
			}
		}

		:global(img) {
			width: 100%;
			clip-path: inset(0 0 0 0 round 20%);
		}

		> span {
			display: inline-block;
			width: 100%;
			text-align: center;
			padding: 50px 0;
			margin: 30px 0;
			font-family: 'Open Sans';
			font-size: 18px;
			color: #444;
			background: #fafafa;
		}
	}

	@media screen and (max-width: 600px) {
		main {
			height: calc(100vh - 40px);
			width: 100vw;

			.compose {
				bottom: 60px;
			}

			.back {
				top: 5px;
			}
		}
	}

	:global(body.dark) {
		:global(a) {
			color: darkgoldenrod;
		}

		:global(a:hover) {
			color: red;
		}
	}
</style>
