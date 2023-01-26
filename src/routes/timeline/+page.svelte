<svelte:head>
    <script src="https://kit.fontawesome.com/66f38a391f.js" crossorigin="anonymous"></script>
</svelte:head>

<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		authenticate,
		SendParams,
		get_note,
		send_note,
		send_encrypted_note,
		get_actor,
		get_inbox,
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

	let profile: UserProfile | null = null;

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
	};

	function sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	onMount(() => {
		load_enigmatick();

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
			});

			let sse = new EventSource('/api/user/' + username + '/events');

			function onMessage(event: any) {
				console.log('event: ' + event.data);
				let e: EnigmatickEvent = JSON.parse(event.data);
				console.log(e);

				if (e.attributedTo) {
					get_actor(e.attributedTo).then((actor) => {
						if (actor) {
							let profile = JSON.parse(actor);
							console.log(profile);

							let icon = '';

							if (profile.icon) {
								icon = `<img src="${profile.icon.url}" />`;
							}

							let d = new Date(e.published).toLocaleString();

							if (!e.inReplyTo) {
								notes.set(String(e.id), [
									e.published,
									`<article>` +
										`<header>` +
										`<div>${icon}</div>` +
										`<address>` +
										`<span>${profile.name}</span>` +
										`<a href="/search?actor=${profile.id}">${profile.url}</a>` +
										`<time datetime="${e.published}">${d}</time>` +
										`</address>` +
										`</header>` +
										`<section>${e.content}</section>` +
										`</article>`,
									0
								]);
								notes = notes;
								console.log(notes);
							} else {
								get_note(e.inReplyTo).then((n) => {
									let note: Note = JSON.parse(String(n));
									console.log('note: ' + n);
									get_actor(note.attributedTo).then((a) => {
										let sender: UserProfile = JSON.parse(String(a));
										console.log('a: ' + a);
										notes.set(String(e.id), [
											e.published,
											`<article>` +
                                                `<span> <i class="fa-solid fa-reply"></i> In reply to ${sender.name || sender.preferredUsername}</span>` +
												`<header>` +
												`<div>${icon}</div>` +
												`<address>` +
												`<span>${profile.name || profile.preferredUsername}</span>` +
												`<a href="/search?actor=${profile.id}">${profile.url}</a>` +
												`<time datetime="${e.published}">${d}</time>` +
												`</address>` +
												`</header>` +
												`<section>${e.content}</section>` +
												`</article>`,
											0
										]);

										notes = notes;
										console.log(notes);
									});
								});
							}
						}
					});
				}
			}

			function restartEventSource(event: any) {
				console.log(event);
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
		console.log('comparing ' + a[0] + ' to ' + b[0]);
		if (Date.parse(a[0]) < Date.parse(b[0])) {
			return -1;
		} else if (Date.parse(a[0]) > Date.parse(b[0])) {
			return 1;
		} else {
			return 0;
		}
	}

	let notes = new Map<string, any[]>();
	let username = get(appData).username;
	let display_name = get(appData).display_name;
</script>

<main>
	{#if notes.size == 0}
		<span>WAITING FOR EVENTS</span>
	{/if}
	{#each Array.from(notes.values()).sort(compare).reverse() as [published, note, replies]}
		{#if note}
			{@html note}
		{/if}
	{/each}
</main>

<style lang="scss">
	main {
		width: 100%;
		height: calc(100vh - 40px);
		overflow-y: auto;

		:global(article) {
			display: flex;
			flex-direction: column;
			width: 100%;
			padding: 10px;
			margin: 5px 0;
			font-family: 'Open Sans';
			background: #fafafa;

            :global(> span) {
                width: 100%;
                padding: 0 0 20px 0;
                font-weight: 600;
                color: darkred;
            }

			:global(address) {
				width: 100%;
				padding: 0 20px;
			}

			:global(address > span),
			:global(address > time) {
				display: inline-block;
				width: 100%;
				font-style: normal;
			}

			:global(address > span:first-child) {
				font-size: 22px;
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
