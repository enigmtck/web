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
	import { action_destroyer } from 'svelte/internal';

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
	};

	function sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function addNote(e: Note) {
		if (e.attributedTo) {
			cachedActor(e.attributedTo).then((actor) => {
				if (actor) {
					let profile = JSON.parse(actor);
					//console.log(profile);

					let icon = '';

					if (profile.icon) {
						icon = `<img src="${profile.icon.url}" />`;
					}

					let d = new Date(String(e.published)).toLocaleString();
					let attachments = '';
					//console.log('attachments: ' + e.attachment);
					if (e.attachment && e.attachment.length > 0) {
						e.attachment.forEach((x) => {
							if (x.type == 'Document' && /^image\/.+$/.test(String(x.mediaType))) {
								attachments += `<div><img src="${x.url}" width="${x.width}" height="${x.height}"/></div>`;
							}
						});
					}

					if (!e.inReplyTo) {
						notes.set(String(e.id), [
							e.published,
							`<header>` +
								`<div>${icon}</div>` +
								`<address>` +
								`<span>${profile.name}</span>` +
								`<a href="/search?actor=${profile.id}">${profile.url}</a>` +
								`<time datetime="${e.published}">${d}</time>` +
								`</address>` +
								`</header>` +
								`<section>${e.content}</section>` +
								`<section class="attachments">${attachments}</section>`,
							0,
							profile.name || profile.preferredUsername,
							e.id
						]);
						notes = notes;
						//console.log(notes);
					} else {
						cachedNote(e.inReplyTo).then((n) => {
							console.log('note: ' + e.inReplyTo + ' result: ' + n);
							let r = '';
							if (n) {
								let note: Note = JSON.parse(String(n));
								cachedActor(note.attributedTo).then((a) => {
									let sender: UserProfile = JSON.parse(String(a));

									notes.set(String(e.id), [
										e.published,
										`<span><i class="fa-solid fa-reply"></i> In reply to ${
											sender.name || sender.preferredUsername
										}</span>` +
											`<header>` +
											`<div>${icon}</div>` +
											`<address>` +
											`<span>${profile.name || profile.preferredUsername}</span>` +
											`<a href="/search?actor=${profile.id}">${profile.url}</a>` +
											`<time datetime="${e.published}">${d}</time>` +
											`</address>` +
											`</header>` +
											`<section>${e.content}</section>` +
											`<section class="attachments">${attachments}</section>`,
										0,
										profile.name || profile.preferredUsername,
										e.id
									]);

                                    notes = notes;
								});
							} else {
								notes.set(String(e.id), [
									e.published,
									`<header>` +
										`<div>${icon}</div>` +
										`<address>` +
										`<span>${profile.name || profile.preferredUsername}</span>` +
										`<a href="/search?actor=${profile.id}">${profile.url}</a>` +
										`<time datetime="${e.published}">${d}</time>` +
										`</address>` +
										`</header>` +
										`<section>${e.content}</section>` +
										`<section class="attachments">${attachments}</section>`,
									0,
									profile.name || profile.preferredUsername,
									e.id
								]);

                                notes = notes;
							}
							
							//console.log(notes);
						});
					}
				}
			});
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
				//console.log('event: ' + event.data);
				let e: Note = JSON.parse(event.data);
				//console.log(e);
				addNote(e);
				offset += 1;
			}

			function restartEventSource(event: any) {
				//console.log(event);
				/* sleep(5000).then(() => {
                    sse.close();
                    sse = new EventSource('/api/user/' + username + '/events');
                    sse.onerror = restartEventSource;
                    sse.onmessage = onMessage;
                }) */
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
	let reply_to_note: string | boolean = false;
	let reply_to_actor: string | boolean = false;
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
							<i class="fa-solid fa-pen-nib" on:click|preventDefault={handlePreview} />
						{:else}
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
	{#if notes.size == 0}
		<span>WAITING FOR EVENTS</span>
	{/if}
	{#each Array.from(notes.values())
		.sort(compare)
		.reverse() as [published, note, replies, sender, in_reply_to]}
		{#if note}
			<article>
				{@html note}
				<nav>
					<i class="fa-solid fa-comments" />
					<i class="fa-solid fa-repeat" />
					<i class="fa-solid fa-star" />
					<i
						class="fa-solid fa-reply"
						data-reply={in_reply_to}
						data-actor={sender}
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

	main {
		width: 100%;
		height: calc(100vh - 40px);
		overflow-y: auto;

		@media screen and (max-width: 600px) {
			width: 100vw;
		}

		article {
			display: flex;
			flex-direction: column;
			width: 100%;
			margin: 5px 0;
			font-family: 'Open Sans';
			background: #fafafa;
			border-radius: 10px;

			:global(> span) {
				width: 100%;
				padding: 10px;
				font-weight: 600;
				color: darkred;
			}

			:global(header) {
				padding: 10px 20px;
			}

			:global(address) {
				width: 100%;
				padding: 0 20px;
			}

			:global(address > span),
			:global(address > time),
			:global(address > a) {
				display: inline-block;
				width: 100%;
				font-style: normal;
				font-size: 13px;
				text-decoration: none;
			}

			:global(address > time),
			:global(address > a) {
				color: #222;
				font-weight: 400;
				transition-duration: 1s;
			}

			:global(address > a:hover) {
				color: red;
				transition-duration: 0.5s;
			}

			:global(address > span:first-child) {
				font-size: 22px;
			}

			:global(section) {
				padding: 0 20px;
				overflow-wrap: break-word;
			}

			:global(.attachments) {
				overflow: hidden;
				padding-bottom: 10px;
				display: flex;
				flex-direction: row;
				align-items: center;
				justify-content: center;

				:global(div) {
					min-width: unset;
					min-height: unset;
					width: unset;
					height: unset;
					text-align: center;
					padding: 0 10px;
				}

				:global(img) {
					width: unset;
					height: unset;
					clip-path: unset;
					max-width: 100%;
					max-height: 300px;
				}
			}

			nav {
				width: 100%;
				background: #eee;
				padding: 5px 0;
				border-radius: 0 0 10px 10px;

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
				width: calc(100% - 100px);
			}

			:global(div:first-child) {
				width: 100px;
			}
		}

		:global(img) {
			width: 100%;
			clip-path: inset(0 0 0 0 round 50%);
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
</style>
