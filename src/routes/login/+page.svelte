<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import { goto } from '$app/navigation';

	let authenticate: any;
	let getState: any;

	onMount(async () => {
		import('enigmatick_wasm').then((enigmatick_wasm) => {
			enigmatick_wasm.default().then(() => {
				authenticate = enigmatick_wasm.authenticate;
				getState = enigmatick_wasm.get_state;

				enigmatick_wasm.load_instance_information().then((instance) => {
					console.log(instance?.domain);
					console.log(instance?.url);

					if (get(wasmState)) {
						enigmatick_wasm.get_state().then(() => {
							enigmatick_wasm.import_state(get(wasmState));
						});
					}
				});
			});
		});
	});

	let username = get(appData).username;

	if (username) {
		goto('/@' + username).then(() => {
			console.log('logged in');
		});
	}

	function handleLogin(event: any) {
		let data = new FormData(event.target);
		console.log('clicked');

		authenticate(
			String(data.get('username')),
			String(data.get('password')),
			String(data.get('passphrase'))
		).then((profile: any) => {
			appData.set({
				username: String(profile?.username),
				display_name: String(profile?.display_name),
				avatar: String(profile?.avatar_filename)
			});
			username = get(appData).username;
			getState().then((x: any) => {
				console.log(x);
				wasmState.set(x.export());
				let data = JSON.stringify({
					pickled_account: x.get_olm_pickled_account(),
					olm_sessions: JSON.parse(x.get_olm_sessions())
				});
				console.log(get(wasmState));

				goto('/@' + username).then(() => {
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

		<div>
			<button>Authenticate</button>
		</div>
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

		h1 {
			font-family: 'Open Sans';
			font-size: 5vw;
			text-align: center;
			font-weight: 300;
			color: darkred;
			margin: 0;
			width: 100%;

			@media screen and (max-width: 600px) {
				font-size: 13vw;
				margin: 0 0 30px 0;
			}
		}

		form {
			display: flex;
			flex-direction: column;
			width: 400px;
			padding: 10px 20px;

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
				}
			}

			div {
				text-align: center;
				border-top: 1px solid #ccc;
				margin-top: 10px;

				button {
					background: darkred;
					color: whitesmoke;
					border: 0;
					font-family: 'Open Sans';
					font-size: 18px;
					font-weight: 600;
					padding: 5px 15px;
					margin: 15px 0;
				}

				button:hover {
					color: darkred;
					background: whitesmoke;
					cursor: pointer;
				}
			}
		}
	}

	:global(body.dark) {
		main {
			h1 {
				color: whitesmoke;
			}

			form {
				background: #222;
				label {
					color: #ddd;
				}
			}
		}
	}
</style>
