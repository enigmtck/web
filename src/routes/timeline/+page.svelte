<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import { Converter } from 'showdown';
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
		get_external_identity_key,
		update_keystore_olm_sessions,
		load_instance_information,
		send_follow,
		send_unfollow,
		send_authorization,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state,
		create_olm_message,
		decrypt_olm_message
	} from 'enigmatick_olm';
	import { goto } from '$app/navigation';
	import { action_destroyer, set_custom_element_data } from 'svelte/internal';

	function load_enigmatick() {
		init_olm().then(() => {
			if (get(olmState)) {
				import_olm_state(get(olmState));
				console.log('loaded olm state from store');
			}
			console.log('init OLM');
		});
	}

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
		tag?: object;
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
		type: 'Mention';
		name: string;
		href: string;
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

	async function addNote(e: Note) {
		if (e.attributedTo) {
			let actor = await cachedActor(e.attributedTo);

			if (actor) {
				let profile = JSON.parse(actor);
				//console.log(profile);

				let icon = '';

				if (profile.icon) {
					icon = `<img src="${profile.icon.url}" />`;
				}

				let attachments = '';
				console.log('attachments: ' + e.attachment);
				if (e.attachment && e.attachment.length > 0) {
					e.attachment.forEach((x) => {
						if (x.type == 'Document' && /^(?:image)\/.+$/.test(String(x.mediaType))) {
							attachments += `<div><img src="${x.url}" width="${x.width}" height="${x.height}"/></div>`;
						} else if (x.type == 'Document' && /^(?:video)\/.+$/.test(String(x.mediaType))) {
							attachments += `<div><video width="${x.width}" height="${x.height}" controls><source src="${x.url}" type="${x.mediaType}"></video></div>`;
						}
					});
				}

				let announce_html = '';

				if (e.ephemeralAnnounce) {
					let announce_actor = await cachedActor(e.ephemeralAnnounce);

					if (announce_actor) {
						let announce_profile: UserProfile = JSON.parse(announce_actor);
						announce_html = `<span class="repost"><i class="fa-solid fa-retweet"></i> Reposted by ${
							announce_profile.name || announce_profile.preferredUsername
						}</span>`;
					}
				}

				let reply_html = '';

				if (e.inReplyTo) {
					let reply_note = await cachedNote(e.inReplyTo);

					if (reply_note) {
						let note: Note = JSON.parse(String(reply_note));

						let reply_actor = await cachedActor(note.attributedTo);
						let sender: UserProfile = JSON.parse(String(reply_actor));

						reply_html = `<span class="reply"><i class="fa-solid fa-reply"></i> In reply to <a href="/conversation?conversation=${encodeURIComponent(
							String(e.conversation)
						)}">${sender.name || sender.preferredUsername}</a></span>`;
					}
				}

				notes.set(String(e.id), [
					e.published,
					announce_html +
						reply_html +
						`<header>` +
						`<div>${icon}</div>` +
						`<address>` +
						`<span>${profile.name || profile.preferredUsername}</span>` +
						`<a href="/search?actor=${profile.id}">${profile.url}</a>` +
						`</address>` +
						`</header>` +
						`<section>${e.content}</section>` +
						`<section class="attachments">${attachments}</section>`,
					0,
					profile.name || profile.preferredUsername,
					e.id,
					e.conversation
				]);
				notes = notes;
				console.log(notes);
			}
		}
	}

	async function load_timeline_data() {
		let x = await get_timeline(offset, 5);

		console.log(x);
		let timeline = JSON.parse(String(x));
		console.log(timeline);

		timeline.forEach((t: Note) => {
			addNote(t);
		});

		offset += 5;
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
		load_enigmatick();

		let main = document.getElementsByTagName('main')[0];
		main.addEventListener('scroll', handleInfiniteScroll);
		if (username) {
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

				load_timeline_data();
			});

			let sse = new EventSource('/api/user/' + username + '/events');

			function onMessage(event: any) {
				console.log('event: ' + event.data);
				let e: Note | StreamConnect | Announce = JSON.parse(event.data);
				console.log(e);

				if ((<Note>e).type === 'Note') {
					addNote(<Note>e);
					offset += 1;
				} else if ((<StreamConnect>e).uuid) {
					send_authorization((<StreamConnect>e).uuid);
				} else if ((<Announce>e).type == 'Announce') {
					let announce = <Announce>e;
					get_note(announce.object).then((x) => {
						console.log('announce: ' + x);
						let note: Note = JSON.parse(String(x));
						note.ephemeralAnnounce = announce.actor;
						note.id = announce.id;
						note.published = announce.published;
						addNote(note);
						offset += 1;
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
		} else {
			goto('/');
		}
	});

	function compare(a: any[], b: any[]) {
		if (Date.parse(a[0]) < Date.parse(b[0])) {
			return -1;
		} else if (Date.parse(a[0]) > Date.parse(b[0])) {
			return 1;
		} else {
			return 0;
		}
	}

	function handleComposeSubmit(event: any) {
		console.log(event);
	}

	function convertToMarkdown(data: string) {
		let converter = new Converter();
		converter.setFlavor('github');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeMarkdown(data);
	}

	function convertToHtml(data: string) {
		let converter = new Converter();
		converter.setFlavor('github');
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

	function updateTime() {
		const time_elements = document.getElementsByTagName('time');

		if (time_elements) {
			Array.from(time_elements).forEach((el) => {
				let d = timeSince(new Date(String(el.getAttribute('datetime'))));
				el.textContent = d;
			});
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

	function handlePublish() {
		captureChanges();

		let params = SendParams.new().set_kind('Note').set_content(html_note);
		if (reply_to_note) {
			params = params
				.set_in_reply_to(String(reply_to_note))
				.set_conversation(String(reply_to_conversation));
		}

		send_note(params).then((x) => {
			if (x) {
				resetCompose();
				console.log('send successful');
			} else {
				console.log('send unsuccessful');
			}
		});
	}

	function handleReplyTo(event: any) {
		reply_to_note = event.target.dataset.reply;
		reply_to_actor = event.target.dataset.actor;
		reply_to_conversation = event.target.dataset.conversation;

		console.log(event.target.dataset);
	}

	function cancelReplyTo() {
		reply_to_note = null;
		reply_to_actor = null;
		reply_to_conversation = null;
	}

	let loading = false;
	async function handleInfiniteScroll() {
		if (!loading) {
			loading = true;
			let main = document.getElementsByTagName('main')[0];

			if (main.scrollTop + main.offsetHeight >= main.scrollHeight - 300) {
				await load_timeline_data();
			}
			loading = false;
		}
	}

	async function cachedActor(id: string) {
		if (!ap_cache.has(id)) {
			ap_cache.set(id, String(await get_actor(id)));
		}

		return ap_cache.get(id);
	}

	async function cachedNote(id: string) {
		if (!ap_cache.has(id)) {
			ap_cache.set(id, String(await get_note(id)));
		}

		return ap_cache.get(id);
	}

	let ap_cache = new Map<string, string>();
	let offset = 0;
	let profile: UserProfile | null = null;
	let notes = new Map<string, any[]>();
	let username = get(appData).username;
	let display_name = get(appData).display_name;
	let markdown_note = '';
	let html_note = '';
	let preview = false;

	let reply_to_note: string | null = null;
	let reply_to_actor: string | null = null;
	let reply_to_conversation: string | null = null;
</script>

<svelte:head>
	<script src="https://kit.fontawesome.com/66f38a391f.js" crossorigin="anonymous"></script>
</svelte:head>

<aside>
	{#if username}
		{#if $page.url.pathname === '/timeline'}
			<div>
				{#if reply_to_actor}
					<span
						>Replying to {reply_to_actor}
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
					<span>
						<i class="fa-solid fa-paperclip" />
						{#if preview}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<i class="fa-solid fa-pen-nib" on:click|preventDefault={handlePreview} />
						{:else}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<i class="fa-solid fa-eye" on:click|preventDefault={handlePreview} />
						{/if}
					</span>
					<button on:click|preventDefault={handlePublish}>Publish</button>
				</form>
			</div>
		{/if}
	{/if}
</aside>

<main>
	{#each Array.from(notes.values())
		.sort(compare)
		.reverse() as [published, note, replies, sender, in_reply_to, conversation]}
		{#if note}
			<article>
				{@html note}
				<time datetime={published}>{timeSince(new Date(String(published)))}</time>
				<nav>
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i
						class="fa-solid fa-comments"
						on:click={async () => {
							await goto(`/conversation?conversation=${conversation}`);
						}}
					/>
					<i class="fa-solid fa-repeat" />
					<i class="fa-solid fa-star" />
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i
						class="fa-solid fa-reply"
						data-reply={in_reply_to}
						data-actor={sender}
						data-conversation={conversation}
						on:click={handleReplyTo}
					/>
				</nav>
			</article>
		{/if}
	{/each}
</main>

<style lang="scss">
	:global(i:hover) {
		cursor: pointer;
		color: red;
		transition-duration: 0.5s;
	}

	aside {
		grid-area: left-aside;
		height: calc(100vh - 40px);
		text-align: right;

		@media screen and (max-width: 600px) {
			display: none;
		}

		div {
			display: inline-block;
			max-width: 400px;
			min-width: 350px;
			margin: 10px;
			padding: 15px 10px 0 10px;
			border-radius: 10px;
			background: #fafafa;
			transition-duration: 1s;

			h1 {
				width: 100%;
				text-align: center;
				font-family: 'Open Sans';
				font-size: 28px;
				font-weight: 400;
				margin: 5px 0;
			}

			> span {
				display: inline-block;
				background: #fafafa;
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
			}

			div {
				padding: 0 10px;
			}

			form {
				text-align: right;

				span {
					display: inline-block;
					width: calc(100% - 110px);
					text-align: left;

					i {
						font-size: 24px;
						transition-duration: 1s;
						padding: 0 10px;
					}

					i:hover {
						cursor: pointer;
						transition-duration: 0.5s;
						color: red;
					}
				}

				button {
					display: inline-block;
					margin: 5px;
					padding: 5px 15px;
					background: darkred;
					color: whitesmoke;
					transition-duration: 1s;
					border: 0;
					font-family: 'Open Sans';
					font-size: 18px;
					font-weight: 600;
				}

				button:hover {
					color: darkred;
					background: whitesmoke;
					transition-duration: 1s;
					cursor: pointer;
				}
			}
		}
	}

	:global(body.dark) {
		aside {
			div {
				background: #222;

				div {
					background: #fff;
				}
			}

			i {
				color: #ccc;
			}
		}
	}

	main {
		width: 100%;
		height: calc(100vh - 40px);
		overflow-y: auto;

		@media screen and (max-width: 600px) {
			width: 100vw;
		}

		article {
			display: flex;
			position: relative;
			flex-direction: column;
			width: 100%;
			margin: 0;
			border-bottom: 3px solid #ddd;
			font-family: 'Open Sans';
			background: #fafafa;
			transition-duration: 1s;

			:global(.reply),
			:global(.repost) {
				width: 100%;
				padding: 5px 10px;
				font-weight: 600;
				font-size: 14px;
				background: #eee;
				color: darkred;
			}

			:global(.repost) {
				color: #444;
			}

			:global(header) {
				padding: 10px 20px;
				color: #222;
			}

			:global(address) {
				position: relative;
				width: 100%;
				padding: 0 15px;
			}

			:global(time) {
				display: inline-block;
				position: absolute;
				top: 5px;
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
				width: 100%;
			}

			:global(address > a) {
				color: inherit;
				font-weight: 400;
				transition-duration: 1s;
			}

			:global(address > a:hover) {
				color: red;
				transition-duration: 0.5s;
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
					padding: 0 10px;
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
				background: #eee;
				padding: 5px 0;

				i {
					text-align: center;
					font-size: 22px;
					color: #777;
					width: calc(95% / 4);
					transition-duration: 1s;
				}

				i:hover {
					cursor: pointer;
					color: red;
					transition-duration: 0.5s;
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

	:global(body.dark) {
		article {
			background: #222;
			color: #fff;
			border-bottom: 3px solid black;

			:global(.reply),
			:global(.repost) {
				background: #222;
				color: #fff;
			}

			:global(.repost) {
				color: #fff;
			}

			:global(header) {
				color: #aaa;
			}

			:global(address > span:first-child) {
				font-size: 18px;
				color: #eee;
			}

			:global(a) {
				color: #ccc;
			}

			:global(a:hover) {
				color: red;
			}

			:global(code) {
				background: #444;
			}
		}

		nav {
			background: #222;

			i {
				color: #ccc;
			}
		}
	}
</style>
