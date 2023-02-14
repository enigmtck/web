<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import { Converter } from 'showdown';
	import init_wasm, {
		authenticate,
		SendParams,
		get_note,
		send_note,
		get_actor,
		load_instance_information,
		send_follow,
		send_unfollow,
		send_authorization,
		get_conversation,
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
		tag?: object;
		attachment?: object;
		endpoints?: object;
		icon?: Image;
		image?: Image;
		ephemeralFollowing?: boolean;
		ephemeralLeaderApId?: string;
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

						reply_html = `<span class="reply"><i class="fa-solid fa-reply"></i> In reply to ${sender.name || sender.preferredUsername}</span>`;
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

	async function load_conversation_data() {
		console.log('conversation: ' + conversation + ' offset: ' + offset);
		if (conversation) {
			let x = await get_conversation(conversation, offset, 5);
			console.log(x);

			let timeline = JSON.parse(String(x));
			//console.log(timeline);

			timeline.forEach((t: Note) => {
				addNote(t);
			});

			offset += 5;
		}
	}

	onMount(() => {
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

				load_conversation_data().then(() => {
					console.log('conversation loaded');
				});
			});

			let sse = new EventSource('/api/user/' + username + '/events');

			function onMessage(event: any) {
				console.log('event: ' + event.data);
				let e: Note | StreamConnect = JSON.parse(event.data);
				console.log(e);

				if ((<Note>e).type === 'Note') {
					addNote(<Note>e);
					offset += 1;
				} else if ((<StreamConnect>e).uuid) {
					send_authorization((<StreamConnect>e).uuid);
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
		if (Date.parse(a[0]) > Date.parse(b[0])) {
			return -1;
		} else if (Date.parse(a[0]) < Date.parse(b[0])) {
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
			params = params.set_in_reply_to(String(reply_to_note));
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
	}

	function cancelReplyTo() {
		reply_to_note = false;
		reply_to_actor = false;
	}

	let loading = false;
	async function handleInfiniteScroll() {
		if (!loading) {
			loading = true;
			let main = document.getElementsByTagName('main')[0];

			if (main.scrollTop + main.offsetHeight >= main.scrollHeight - 300) {
				await load_conversation_data();
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

	let conversation = $page.url.searchParams.get('conversation');
	let ap_cache = new Map<string, string>();
	let offset = 0;
	let profile: UserProfile | null = null;
	let notes = new Map<string, any[]>();
	let username = get(appData).username;
	let display_name = get(appData).display_name;
	let markdown_note = '';
	let html_note = '';
	let preview = false;
	let reply_to_note: string | boolean = false;
	let reply_to_actor: string | boolean = false;
</script>

<svelte:head>
	<script src="https://kit.fontawesome.com/66f38a391f.js" crossorigin="anonymous"></script>
</svelte:head>

<main>
	{#if notes.size == 0}
		<span>WAITING FOR EVENTS</span>
	{/if}
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
							await goto(`/thread?conversation=${conversation}`);
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
			border-bottom: 1px solid #ddd;
			font-family: 'Open Sans';
			background: #fafafa;
			transition-duration: 1s;

			:global(a) {
				color: darkgoldenrod;
			}

			:global(a:hover) {
				color: red;
			}

			:global(.reply),
			:global(.repost) {
				width: 100%;
				padding: 10px 10px 5px 10px;
				font-weight: 600;
				font-size: 14px;
				background: #fafafa;
				color: darkred;
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
				background: #fafafa;
				padding: 5px 0;
				margin: 0 0 10px 0;

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
			background: #000;
			color: #fff;
			border-bottom: 1px solid #444;

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

			:global(code) {
				background: #444;
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
