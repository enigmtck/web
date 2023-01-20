<script lang="ts">
	import { page } from '$app/stores';
	console.log($page.params);

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		authenticate,
		SendParams,
		send_note,
		send_encrypted_note,
		get_inbox,
		get_processing_queue,
		get_external_identity_key,
		init_sse,
		update_keystore_olm_sessions,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state,
		create_olm_message,
		decrypt_olm_message
	} from 'enigmatick_olm';

	function load_enigmatick() {
		init_wasm().then(() => {
			if (get(wasmState)) {
				get_wasm_state().then(() => {
					import_wasm_state(get(wasmState));
					console.log('loaded state from store');
				});
			}
			console.log('init WASM');
		});

		init_olm().then(() => {
			if (get(olmState)) {
				import_olm_state(get(olmState));
				console.log('loaded olm state from store');
			}
			console.log('init OLM');
		});
	}

	type UserProfile = {
		'@context': string;
		type: string;
		name: string;
		summary: string;
		id: string;
		preferredUsername: string;
		inbox: string;
		outbox: string;
		followers: string;
		following: string;
		liked: string;
		publicKey: object;
	};

	let profile: UserProfile | null = null;

	onMount(() => {
		load_enigmatick();

		console.log($page.params);
		fetch('/user/' + $page.params.handle).then((x) => {
			x.json().then((y: UserProfile) => {
				console.log(y);
				profile = y;
			});
		});
	});

	let username = get(appData).username;
	let display_name = get(appData).display_name;
</script>

<header>
	<div>
		<span class="title"><a href="/">ENIGMATICK</a></span>
		{#if display_name}
			<nav>
				<span class="person"><a href="/@{username}">{display_name}</a></span>
			</nav>
		{/if}
	</div>
</header>
<main>
	{#if profile}
		<div>
			<h1>{profile.name}</h1>
			<div>
				<span>{profile.summary}</span>
			</div>
		</div>
	{/if}
</main>

<style lang="scss">
	header {
		width: 100%;
		padding: 5px;
		background: #222;
		color: #eee;
		text-align: center;
		font-family: 'Open Sans';
		font-size: 22px;
		font-weight: 600;

		a {
			color: #eee;
			text-decoration: none;
		}

		a:visited {
			color: #eee;
		}

		a:hover {
			color: red;
			transition-duration: 0.5s;
			text-decoration: none;
		}

		nav {
			display: block;
			position: fixed;
			right: 0;
			top: 0;
			padding: 2px 5px;
			text-align: right;

			.person {
				display: inline-block;
				font-size: 18px;
				font-weight: 400;
			}
		}

		@media screen and (max-width: 600px) {
			text-align: left;
		}
	}

	main {
		display: block;
		width: 800px;
		margin: 0 auto 0 auto;
		padding: 15px;
		font-family: 'Open Sans';
	}
</style>
