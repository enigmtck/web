<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import { Converter } from 'showdown';
	import showdownHighlight from 'showdown-highlight';

	import init_wasm, {
		authenticate,
		SendParams,
		get_note,
		send_note,
		send_encrypted_note,
		get_actor,
		get_inbox,
		get_timeline,
		get_processing_queue,
		get_webfinger_from_id,
		load_instance_information,
		send_follow,
		send_like,
		send_unfollow,
		send_authorization,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import { goto } from '$app/navigation';

	type Image = {
		mediaType?: string;
		type: string;
		url: string;
	};

	type UserProfile = {
		'@context': string;
		type: string;
		name?: string;
		summary?: string;
		id?: string;
		preferredUsername: string;
		inbox: string;
		outbox: string;
		followers: string;
		following: string;
		liked?: string;
		publicKey: object;
		featured?: string;
		featuredTags?: string;
		url?: string;
		manuallyApprovesFollowers?: boolean;
		published?: string;
		tag?: Tag[];
		attachment?: object;
		endpoints?: object;
		icon?: Image;
		image?: Image;
		ephemeralFollowing?: boolean;
		ephemeralLeaderApId?: string;
	};

	type EnigmatickEventObject = {
		id: string;
	};

	type EnigmatickEvent = {
		'@context': string;
		type: string;
		id?: string;
		actor?: string | null;
		to?: string | null;
		cc?: string | null;
		object?: EnigmatickEventObject | string | null;
		attributedTo?: string | null;
		content?: string | null;
		published: string;
		inReplyTo?: string | null;
	};

	type Announce = {
		'@context': string;
		id: string;
		actor: string;
		cc: string[];
		to: string[];
		object: string;
		published: string;
		type: 'Announce';
	};

	type Tag = {
		type: 'Mention' | 'Emoji' | 'Hashtag';
		name: string;
		href?: string;
		id?: string;
		updated?: string;
		icon?: Image;
	};

	type Attachment = {
		type: 'PropertyValue' | 'Document' | 'IdentityProof';
		name?: string | null;
		value?: string | null;
		mediaType?: string | null;
		url?: string | null;
		blurhash?: string | null;
		width?: number | null;
		height?: number | null;
	};

	type Note = {
		'@context': string;
		type: 'Note';
		tag?: Tag[];
		id?: string;
		actor?: string | null;
		to?: string[];
		cc?: string[];
		url?: string;
		attributedTo: string;
		content?: string | null;
		replies?: object | null;
		published: string | null;
		inReplyTo?: string | null;
		attachment?: Attachment[];
		conversation: string | null;
		ephemeralAnnounce?: string | null;
		ephemeralActors?: UserProfile[];
	};

	type StreamConnect = {
		uuid: string;
	};

	function sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function timeSince(date: any) {
		let now: any = new Date();

		var seconds = Math.floor((now - date) / 1000);

		var interval = seconds / 31536000;

		if (interval > 1) {
			return Math.floor(interval) + 'yr';
		}
		interval = seconds / 2592000;
		if (interval > 1) {
			return Math.floor(interval) + 'mo';
		}
		interval = seconds / 86400;
		if (interval > 1) {
			return Math.floor(interval) + 'd';
		}
		interval = seconds / 3600;
		if (interval > 1) {
			return Math.floor(interval) + 'h';
		}
		interval = seconds / 60;
		if (interval > 1) {
			return Math.floor(interval) + 'm';
		}
		return Math.floor(seconds) + 's';
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

	function insertEmojis(text: string, profile: UserProfile | Note) {
		if (profile.tag) {
			profile.tag.forEach((tag) => {
				if (tag.type === 'Emoji') {
					if (tag.icon) {
						text = text.replaceAll(tag.name, `<img class="emoji" src="${tag.icon.url}"/>`);
					}
				}
			});
		}

		return text;
	}

	async function replyToHeader(note: Note): Promise<String> {
		if (note.inReplyTo) {
			const reply_note = await cachedNote(note.inReplyTo);

			if (reply_note) {
				const note: Note = JSON.parse(String(reply_note));

				const reply_actor = await cachedActor(note.attributedTo);

				const sender: UserProfile | null = parseProfile(reply_actor);

				if (sender) {
					const name = insertEmojis(sender.name || sender.preferredUsername, sender);

					return `<span class="reply"><i class="fa-solid fa-reply"></i> In reply to ${name}</span>`;
				} else {
					return '';
				}
			} else {
				return '';
			}
		} else {
			return '';
		}
	}

	async function announceHeader(note: Note): Promise<String> {
		if (note.ephemeralAnnounce) {
			const announce_actor = await cachedActor(note.ephemeralAnnounce);

			if (announce_actor) {
				const announce_profile: UserProfile | null = parseProfile(announce_actor);

				if (announce_profile) {
					const name = insertEmojis(
						announce_profile.name || announce_profile.preferredUsername,
						announce_profile
					);

					return `<span class="repost"><i class="fa-solid fa-retweet"></i> Reposted by ${name}</span>`;
				} else {
					return '';
				}
			} else {
				return '';
			}
		} else {
			return '';
		}
	}

	function attachmentsDisplay(note: Note): String {
		let attachments = '';
		if (note.attachment && note.attachment.length > 0) {
			note.attachment.forEach((x) => {
				if (x.type == 'Document' && /^(?:image)\/.+$/.test(String(x.mediaType))) {
					attachments += `<div><img src="${x.url}" width="${x.width}" height="${x.height}"/></div>`;
				} else if (x.type == 'Document' && /^(?:video)\/.+$/.test(String(x.mediaType))) {
					attachments += `<div><video width="${x.width}" height="${x.height}" controls><source src="${x.url}" type="${x.mediaType}"></video></div>`;
				}
			});
		}

		return attachments;
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

					if (note.inReplyTo) {
						// if this is a reply to another note, see if that parent note exists to add to
						let stored = notes.get(note.inReplyTo);

						if (stored) {
							// parent note exists, put this one in its replies
							stored.replies?.push(displayNote);
							notes.set(String(stored.note.id), stored);
						} else {
							// parent note does not (yet) exist, add this one to the main list
							notes.set(String(note.id), displayNote);
						}
					} else {
						// this is a top-level note, check other notes to see if they
						// should be moved to this note's replies
						let toDelete: string[] = [];

						Array.from(notes.values()).forEach((stored) => {
							if (stored.note.inReplyTo == note.id) {
								displayNote.replies.push(stored);
								toDelete.push(String(stored.note.id));
							}
						});

						toDelete.forEach((n) => {
							notes.delete(n);
						});

						notes.set(String(note.id), displayNote);
					}
				}

				notes = notes;
			}
		}
	}

	class DisplayNote {
		note: Note;
		actor: UserProfile;
		published: string;
		replies: DisplayNote[];

		constructor(profile: UserProfile, note: Note, replies?: DisplayNote[]) {
			this.note = note;
			this.actor = profile;
			this.published = String(note.published);
			this.replies = replies || [];
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
				if (await loadTimelineData()) {
					await loadMinimum();
				}
			} catch (e) {
				console.error(e);
			}
		}
	}

	async function loadTimelineData() {
		let x = await get_timeline(offset, 5);

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

			offset += 5;
			return timeline.length;
		} catch (e) {
			console.error(e);
			console.debug(x);
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

	onMount(() => {
		let main = document.getElementsByTagName('main')[0];
		main.addEventListener('scroll', handleInfiniteScroll);

		init_wasm().then(() => {
			load_instance_information().then((instance) => {
				console.log(instance?.domain);
				console.log(instance?.url);

				if (get(wasmState)) {
					get_wasm_state().then(() => {
						import_wasm_state(get(wasmState));
						console.log('loaded state from store');
					});
				}
				console.log('init WASM');

				//loadTimelineData();
				loadMinimum();

				if (username) {
					let sse = new EventSource('/api/user/' + username + '/events');

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
							send_authorization((<StreamConnect>e).uuid).then((x) => {
								console.info('AUTHORIZATION SENT');
							});
						} else if ((<Announce>e).type == 'Announce') {
							let announce = <Announce>e;
							get_note(announce.object).then((x) => {
								try {
									let note: Note = JSON.parse(String(x));
									note.ephemeralAnnounce = announce.actor;
									note.id = announce.id;
									note.published = announce.published;
									addNote(note);
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
						console.log(sse);

						if (sse.readyState == 2) {
							sleep(2000).then(() => {
								sse = new EventSource('/api/user/' + username + '/events');
								sse.onerror = restartEventSource;
								sse.onmessage = onMessage;
							});
						}
					}

					sse.onerror = restartEventSource;
					sse.onmessage = onMessage;

					return () => {
						if (sse.readyState === 1) {
							sse.close();
						}
					};
				}
			});
		});
	});

	function compare(a: DisplayNote, b: DisplayNote) {
		if (Date.parse(a.published) < Date.parse(b.published)) {
			return -1;
		} else if (Date.parse(a.published) > Date.parse(b.published)) {
			return 1;
		} else {
			return 0;
		}
	}

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

	async function handleLike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		await send_like(actor, object);
	}

	async function handlePublish() {
		captureChanges();

		let params = (await SendParams.new()).set_content(html_note).set_public();

		if (reply_to_note) {
			params = await params.add_recipient_id(String(reply_to_recipient), true);
			params = params.set_in_reply_to(String(reply_to_note));
			params = params.set_conversation(String(reply_to_conversation));
		}

		//console.log(params.export());

		send_note(params).then((x) => {
			if (x) {
				resetCompose();
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

	function handleNoteSelect(event: any) {
		focus_conversation = event.target.dataset.conversation;
		focus_note = event.target.dataset.note;

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

	async function handleReplyTo(event: any) {
		reply_to_recipient = event.target.dataset.recipient;
		reply_to_note = event.target.dataset.reply;
		reply_to_display = event.target.dataset.display;
		reply_to_conversation = event.target.dataset.conversation;

		const reply_to_url = event.target.dataset.url;
		const reply_to_username = event.target.dataset.username;

		//const webfinger_acct = await get_webfinger_from_id(String(reply_to_recipient));
		markdown_note = `<span class="h-card"><a href="${reply_to_url}" class="u-url mention" rel="noopener noreferrer">@${reply_to_username}</a></span> `;

		openAside(event);
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

			while (main.scrollTop + main.offsetHeight >= main.scrollHeight * 0.7) {
				await loadTimelineData();
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
			ap_cache.set(id, await get_actor(id));
		}

		return ap_cache.get(id);
	}

	async function cachedNote(id: string) {
		if (!ap_cache.has(id)) {
			ap_cache.set(id, await get_note(id));
		}

		return ap_cache.get(id);
	}

	function closeAside(event: any) {
		cancelReplyTo();
		const dialog = document.getElementsByTagName('dialog')[0];
		dialog.close();

		const mask = document.getElementsByClassName('mask')[0];
		mask.classList.add('closed');
	}

	function openAside(event: any) {
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
		{#if note.note && ((!focus_note && !note.note.inReplyTo) || note.note.id == focus_note)}
			<article>
				{#await replyToHeader(note.note) then replyTo}
					{@html replyTo}
				{/await}
				{#await announceHeader(note.note) then announce}
					{@html announce}
				{/await}

				<header>
					<div>
						{#if note.actor.icon}
							<img src={note.actor.icon.url} alt="Sender" />
						{/if}
					</div>
					<address>
						<span
							>{@html insertEmojis(
								note.actor.name || note.actor.preferredUsername,
								note.actor
							)}</span
						>
						<a href="/search?actor=${note.actor.id}">{note.actor.url}</a>
					</address>
				</header>
				<section>{@html insertEmojis(note.note.content || '', note.note)}</section>
				{#if note.note.attachment && note.note.attachment.length > 0}
					<section class="attachments">{@html attachmentsDisplay(note.note)}</section>
				{/if}

				{#if note.replies?.length}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<span class="comments"
						><i
							class="fa-solid fa-comments"
							data-conversation={note.note.conversation}
							data-note={note.note.id}
							on:click|preventDefault={handleNoteSelect}
						/>
						{note.replies?.length}</span
					>
				{/if}
				<time datetime={note.published}>{timeSince(new Date(String(note.published)))}</time>
				{#if username}
					<nav>
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<i
							class="fa-solid fa-expand"
							data-conversation={note.note.conversation}
							data-note={note.note.id}
							on:click|preventDefault={handleNoteSelect}
						/>
						<i class="fa-solid fa-repeat" />
						<i class="fa-solid fa-star" />
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<i
							class="fa-solid fa-reply"
							data-reply={note.note.id}
							data-display={note.actor.name || note.actor.preferredUsername}
							data-url={note.actor.url}
							data-username={note.actor.name}
							data-recipient={note.actor.id}
							data-conversation={note.note.conversation}
							on:click={handleReplyTo}
						/>
					</nav>
				{/if}
			</article>

			{#if note.note.id == focus_note && note.replies?.length}
				<div class="replies">
					{#each Array.from(note.replies).sort(compare) as reply}
						<article>
							<div class="avatar">
								<div>
									{#if reply.actor.icon}
										<img src={reply.actor.icon.url} alt="Sender" />
									{/if}
								</div>
							</div>
							<address>
								<a href="/search?actor=${reply.actor.id}"
									>{@html insertEmojis(
										reply.actor.name || reply.actor.preferredUsername,
										reply.actor
									)}</a
								>
							</address>
							<section>{@html insertEmojis(reply.note.content || '', reply.note)}</section>
							{#if reply.note.attachment && reply.note.attachment.length > 0}
								<section class="attachments">{@html attachmentsDisplay(reply.note)}</section>
							{/if}

							{#if reply.replies?.length}
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<span class="comments"
									><i
										class="fa-solid fa-comments"
										data-conversation={reply.note.conversation}
										data-note={reply.note.id}
										on:click|preventDefault={handleNoteSelect}
									/>
									{reply.replies?.length}</span
								>
							{/if}
							<time datetime={reply.published}>{timeSince(new Date(String(reply.published)))}</time>
							{#if username}
								<nav>
									<i class="fa-solid fa-repeat" />
									<i class="fa-solid fa-star" />
									<!-- svelte-ignore a11y-click-events-have-key-events -->
									<i
										class="fa-solid fa-reply"
										data-reply={reply.note.id}
										data-display={reply.actor.name || reply.actor.preferredUsername}
										data-url={reply.actor.url}
										data-username={reply.actor.name}
										data-recipient={reply.actor.id}
										data-conversation={reply.note.conversation}
										on:click={handleReplyTo}
									/>
								</nav>
							{/if}
						</article>
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
		margin-top: unset;
		position: fixed;
		top: calc(50vh - 100px);
		left: 0;
		z-index: 30;
		text-align: unset;
		padding: 0;
		border: 0;
		border-radius: 10px;

		div {
			display: inline-block;
			max-width: 600px;
			min-width: 350px;
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
				border-radius: 5px;
				margin: 5px 0;
				font-family: 'Open Sans';
			}

			pre,
			div {
				text-align: left;
				width: 100%;
				padding: 10px;
				margin: 0;
				background: white;
				min-height: 150px;
				border: 1px solid #eee;
				font-family: 'Open Sans';
				border-radius: 10px;
				word-wrap: break-word;
				overflow: hidden;
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
			margin-top: unset;
			position: fixed;
			top: 0;
			left: 0;
			width: 100vw;
			max-width: unset;
			max-height: unset;
			margin: 0;
			height: 100vh;
			z-index: 21;
			text-align: unset;
			background: #ddd;
			border-radius: unset;

			.mask {
				display: none;
			}

			div {
				position: relative;
				display: inline-block;
				margin: 0;
				padding: 0;
				border: 0;
				border-radius: 0;
				height: auto;
				width: 100%;
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
					margin: 5px;
				}

				pre,
				div {
					position: relative;
					display: block;
					height: calc(100% - 105px);
					width: calc(100vw - 12px);
					margin: 5px;
					border-radius: 0;
					border: 1px solid #aaa;
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

		article {
			display: flex;
			position: relative;
			flex-direction: column;
			width: 100%;
			margin: 0;
			border-bottom: 1px solid #ddd;
			font-family: 'Open Sans';
			background: #fafafa;
			overflow: hidden;

			:global(a) {
				color: darkgoldenrod;
			}

			:global(a:hover) {
				color: red;
			}

			:global(.reply),
			:global(.repost) {
				width: calc(100% - 130px);
				white-space: nowrap;
				text-overflow: ellipsis;
				overflow: hidden;
				display: block;
				padding: 10px 10px 5px 10px;
				font-weight: 600;
				font-size: 14px;
				background: #fafafa;
				color: darkred;
			}

			:global(header) {
				padding: 10px 20px;
				color: #222;

				:global(address) {
					position: relative;
					width: calc(100% - 130px);
					padding: 0 15px;

					:global(span),
					:global(a) {
						display: block;
						overflow: hidden;
						white-space: nowrap;
						text-overflow: ellipsis;
					}
				}
			}

			:global(.comments) {
				display: inline-block;
				position: absolute;
				top: 10px;
				right: 50px;
				font-size: 14px;
				font-weight: 600;
				color: inherit;

				:global(i) {
					color: #555;
				}
			}

			:global(.comments:hover) {
				color: red;

				:global(i) {
					color: red;
				}
			}

			:global(time) {
				display: inline-block;
				position: absolute;
				top: 10px;
				right: 10px;
				font-style: normal;
				font-size: 14px;
				text-decoration: none;
				color: inherit;
				font-weight: 600;
			}

			:global(address > span),
			:global(address > a) {
				display: inline-block;
				font-style: normal;
				font-size: 12px;
				text-decoration: none;
			}

			:global(address > span) {
				display: inline-block;
				position: relative;
				width: 100%;
			}

			:global(address > a) {
				color: inherit;
				font-weight: 400;
			}

			:global(address > a:hover) {
				color: red;
			}

			:global(address > span:first-child) {
				font-size: 18px;
				color: #222;
			}

			:global(section) {
				padding: 0 20px;
				overflow-wrap: break-word;
			}

			:global(section > p) {
				margin: 10px 0;
			}

			:global(.emoji) {
				max-height: 1em;
				padding: 0 0.25em;
				width: auto;
				height: auto;
			}

			:global(.attachments) {
				overflow: hidden;
				padding-bottom: 10px;
				display: flex;
				flex-direction: row;
				flex-wrap: wrap;
				align-items: center;
				justify-content: center;

				:global(div) {
					min-width: unset;
					min-height: unset;
					width: unset;
					height: unset;
					text-align: center;
					padding: 0;
					width: 100%;
				}

				:global(img),
				:global(video) {
					width: unset;
					height: unset;
					clip-path: unset;
					width: 100%;
				}
			}

			nav {
				width: 100%;
				position: absolute;
				z-index: unset;
				top: unset;
				right: unset;
				bottom: 0;
				left: 0;
				background: #eee;
				padding: 5px 0;
				margin: 0;
				opacity: 0.3;
				transform: translateY(100%);
				transition-duration: 300ms;

				i {
					text-align: center;
					font-size: 14px;
					color: #444;
					width: calc(95% / 4);
				}

				i:hover {
					cursor: pointer;
					color: red;
				}
			}

			nav:hover {
				opacity: 1;
			}
		}

		article:hover {
			nav {
				transform: translateY(0);
			}
		}

		div.replies {
			article {
				display: grid;
				grid-template-columns: 75px 1fr;
				grid-auto-rows: minmax(10px, auto);
				grid-template-areas:
					'avatar address'
					'avatar content'
					'avatar attachments';

				.avatar {
					grid-area: avatar;
					padding: 10px;

					img {
						width: 55px;
					}
				}

				address {
					grid-area: address;
					padding-top: 10px;
					width: calc(100% - 100px);

					span:first-child,
					a {
						display: block;
						font-size: 16px;
						overflow: hidden;
						white-space: nowrap;
						text-overflow: ellipsis;
					}
				}

				section {
					grid-area: content;
					padding: 0;

					p {
						width: 100%;
						margin: 5px 0;
						padding: 0 5px 0 0;
						font-size: 14px;
					}
				}

				.attachments {
					grid-area: attachments;
				}

				nav {
					i {
						width: calc(95% / 3);
					}
				}
			}
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
			height: calc(100vh - 91px);
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
		article {
			background: #000;
			color: #fff;
			border-bottom: 1px solid #222;

			:global(.reply),
			:global(.repost) {
				background: #000;
				color: #aaa;
			}

			:global(header) {
				color: #aaa;
			}

			:global(address > span:first-child) {
				font-size: 18px;
				color: #eee;
			}

			:global(a) {
				color: darkgoldenrod;
			}

			:global(a:hover) {
				color: red;
			}

			nav {
				background: #555;

				i {
					color: #fff;
				}

				i:hover {
					color: red;
				}
			}
		}

		nav {
			background: #000;

			i {
				color: #ccc;
			}
		}
	}
</style>
