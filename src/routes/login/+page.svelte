<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		authenticate,
		load_instance_information,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state
	} from 'enigmatick_olm';
	import { goto } from '$app/navigation';

	function load_enigmatick() {
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
			});

			init_olm().then(() => {
				if (get(olmState)) {
					import_olm_state(get(olmState));
					console.log('loaded olm state from store');
				}
				console.log('init OLM');
			});
		});
	}

	let username = get(appData).username;

	if (username) {
		goto('/profile').then(() => {
			console.log('logged in');
		});
	}

	onMount(() => {
		load_enigmatick();
	});

	function handleLogin(event: any) {
		let data = new FormData(event.target);

		authenticate(
			String(data.get('username')),
			String(data.get('password')),
			String(data.get('passphrase'))
		).then((profile) => {
			appData.set({
				username: String(profile?.username),
				display_name: String(profile?.display_name)
			});
			username = get(appData).username;
			get_wasm_state().then((x) => {
				console.log(x);
				wasmState.set(x.export());
				let data = JSON.stringify({
					pickled_account: x.get_olm_pickled_account(),
					olm_sessions: JSON.parse(x.get_olm_sessions())
				});
				import_olm_state(data);
				console.log(get(wasmState));

				olmState.set(get_olm_state().export());

				goto('/profile').then(() => {
					console.log('logged in');
				});
			});
		});
	}
</script>

<main>
	<h1>ENIGMATICK</h1>
	<form id="login" method="POST" on:submit|preventDefault={handleLogin}>
		<label>
			Username
			<input name="username" type="text" placeholder="bob" />
		</label>

		<label>
			Password
			<input name="password" type="password" placeholder="Provides access to the server" />
		</label>

		<label>
			Passphrase
			<input name="passphrase" type="password" placeholder="Decrypts the retrieved configuration" />
		</label>

		<button>AUTHENTICATE</button>
	</form>
</main>

<style lang="scss">
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100vw;
		height: 100vh;
		background: #e9cccf;

		h1 {
			font-family: 'Open Sans';
			font-size: 5vw;
			text-align: center;
			font-weight: 300;
			color: darkred;
			margin: 0;
			width: 100%;
		}

		form {
			display: flex;
			flex-direction: column;
			width: 300px;

			label {
				width: 100%;
				padding: 5px 0;
				font-family: 'Open Sans';
				font-size: 14px;

				input {
					width: 100%;
					padding: 10px;
					margin: 5px 0;
					border-radius: 7px;
					border: 0;
					outline: 1px solid #999;
				}

				input:hover,
				input:focus {
					outline: 1px solid darkred;
					transition-duration: 0.5s;
				}
			}

			button {
				border: 1px solid darkred;
				border-radius: 7px;
				background: #fafafa;
				color: darkred;
				font-family: 'Open Sans';
				font-size: 16px;
				font-weight: 400;
				padding: 7px;
				margin: 10px 0;
			}

			button:hover {
				color: white;
				background: darkred;
				transition-duration: 0.5s;
				cursor: pointer;
			}
		}
	}
</style>
