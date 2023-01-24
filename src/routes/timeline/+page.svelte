<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		authenticate,
		SendParams,
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
	};

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

			const sse = new EventSource('/api/user/' + username + '/events');
			sse.onmessage = (event) => {
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

							notes.unshift(
								`<article>` +
									`<header>` +
									`<div>${icon}</div>` +
									`<address><span>${profile.name}</span><span>${profile.url}</span></address>` +
									`</header>` +
									`<section>${e.content}</section>` +
									`</article>`
							);
							notes = notes;
						}
					});
				}
			};
			return () => {
				if (sse.readyState === 1) {
					sse.close();
				}
			};
		} else {
			goto('/');
		}
	});

	let notes: string[] = [];
	let username = get(appData).username;
	let display_name = get(appData).display_name;
</script>

<main>
	{#each notes as note}
		{@html note}
	{/each}
</main>

<style lang="scss">
	main {
		width: 100%;
        transition-duration: 1s;
        height: calc(100vh - 40px);
        overflow-y: auto;

		:global(article) {
			display: flex;
			flex-direction: column;
			width: 100%;
			padding: 10px;
            font-family: "Open Sans";

            :global(address) {
                width: 100%;
                padding: 0 20px;
            }

            :global(address > span) {
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
	}
</style>
