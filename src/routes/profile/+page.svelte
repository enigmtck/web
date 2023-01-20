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
		init_sse,
		update_keystore_olm_sessions,
		load_instance_information,
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
	});

	function handleProfile(event: any) {
		let data = new FormData(event.target);
		console.log('looking up: ' + data.get('address'));

		get_actor(String(data.get('address'))).then((actor) => {
			console.log(actor);
		});
	}

	let username = get(appData).username;
	let display_name = get(appData).display_name;
</script>

<svelte:head>
	<style>
		body {
			display: flex;
			flex-direction: column;
		}
	</style>
</svelte:head>

<header>
	<div>
		<span class="title"><a href="/">ENIGMATICK</a></span>
	</div>

	{#if display_name}
		<nav>
			<span class="person"><a href="/@{username}">{display_name}</a></span>
		</nav>
	{/if}
</header>

<main>
	<form id="profile" method="POST" on:submit|preventDefault={handleProfile}>
		<label>
			<input type="text" id="address" name="address" placeholder="@address@server.url" />
		</label>
	</form>
</main>

<style lang="scss">
	a,
	a:visited {
		color: #222;
		text-decoration: none;
	}

	a:hover {
		color: red;
		transition-duration: 0.5s;
		text-decoration: none;
	}

	* {
		font-family: 'Open Sans';
	}

	header {
		width: 100%;
		padding: 5px;
		background: #222;
		color: #eee;
		text-align: center;
		font-family: 'Open Sans';
		font-size: 22px;
		font-weight: 600;
		height: auto;

		a {
			color: #eee;
			text-decoration: none;
		}

		a:visited {
			color: #eee;
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
		max-width: 500px;
		width: 100%;
		margin: 0 auto 0 auto;
		padding: 15px;
	}

	input {
		width: 100%;
		padding: 15px;
		border-radius: 10px;
		border: 0;
		outline: 1px solid #ccc;
		font-size: large;
	}
</style>
