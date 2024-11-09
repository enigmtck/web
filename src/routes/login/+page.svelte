<script lang="ts">
	import { get } from 'svelte/store';
	import { wasmState, appData, enigmatickWasm } from '../../stores';
	import { goto } from '$app/navigation';
	import type { Collection } from '../../common';

	$: wasm = $enigmatickWasm;

	let username = get(appData).username;

	if (username) {
		goto('/@' + username).then(() => {
			console.log('logged in');
		});
	}

	async function handleLogin(event: any) {
		let data = new FormData(event.target);
		console.log('clicked');

		let profile: any = await wasm?.authenticate(
			String(data.get('username')),
			String(data.get('password'))
		);

		if (profile) {
			let instance = await wasm?.load_instance_information();

			appData.set({
				username: String(profile?.username),
				display_name: String(profile?.display_name),
				avatar: String(profile?.avatar_filename),
				domain: instance?.domain || null,
				url: instance?.url || null
			});
			username = get(appData).username;

			let state = wasm?.get_state();
			console.debug(state);

			if (state) {
				wasmState.set(state.export());
				/* 						let data = JSON.stringify({
							pickled_account: x.get_olm_pickled_account(),
							olm_sessions: JSON.parse(x.get_olm_sessions())
						});
						console.log(get(wasmState)); */

				let result = await wasm?.replenish_otk();
				console.debug(`REPLENISH RESULT: ${result}`);
			}

			goto('/@' + username).then(() => {
				console.log('logged in');
			});
		} else {
			console.debug('authentication failed');
			failure.showModal();
		}
	}

	let failure: HTMLDialogElement;
</script>

<main>
	<h1>ENIGMATICK</h1>
	<dialog bind:this={failure}>
		<form method="dialog">
			<h3>Authentication Failed</h3>
			<p>
				Either the information you submitted was incorrect, or there is a problem with the service.
				If you suspect the latter, please try again later.
			</p>
			<button>Okay</button>
		</form>
	</dialog>
	<form id="login" method="POST" on:submit|preventDefault={handleLogin}>
		<label>
			Username
			<input name="username" type="text" placeholder="bob" />
		</label>

		<label>
			Password
			<input name="password" type="password" placeholder="Use a password manager" />
		</label>

		<button>Sign In</button>
	</form>
</main>

<svelte:head>
	<style lang="scss">
		body {
			margin: 0;
			padding: 0;
			height: 100%;
			width: 100%;
			display: block;
			background: white;

			@media screen and (max-width: 700px) {
				background: #fafafa;
			}
		}
	</style>
</svelte:head>

<style lang="scss">
	main {
		position: absolute;
		top: calc(50% - 150px);
		left: calc(50% - 200px);
		padding: 0;
		width: 400px;
		height: 300px;
		max-width: unset;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		@media screen and (max-width: 700px) {
			height: unset;
			width: 80%;
			left: 10%;
		}

		h1 {
			font-family: 'Open Sans';
			font-size: 7vw;
			text-align: center;
			font-weight: 300;
			color: darkred;
			padding: 0;
			margin: 0;
			background: inherit;

			@media screen and (max-width: 700px) {
				font-size: 12vw;
				background: #fafafa;
			}
		}

		h3 {
			margin: 0;
			padding: 0;
			font-family: 'Open Sans';
			color: #222;
			font-weight: 500;
		}

		p {
			font-family: 'Open Sans';
			font-size: 14px;
		}

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
			transition: 300ms;
			cursor: pointer;
		}

		dialog {
			padding: 0;
			border: 1px solid #ccc;
			border-radius: 10px;
		}

		form {
			display: flex;
			background: #fafafa;
			flex-direction: column;
			width: 400px;
			padding: 10px 20px;

			@media screen and (max-width: 700px) {
				width: 100%;
				outline: 0;
			}

			label {
				width: 100%;
				padding: 5px 0;
				font-family: 'Open Sans';
				font-size: 14px;

				input {
					width: 100%;
					padding: 10px;
					margin: 5px 0;
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
				margin-top: 10px;
			}
		}
	}

	:global(body.dark) {
		background: #222;

		main {
			h1 {
				color: whitesmoke;
				background: #222;
			}

			h3 {
				color: whitesmoke;
			}

			dialog {
				border-color: #555;
			}

			form {
				background: #444;
				outline: 0;
				label {
					color: #ddd;
				}

				p {
					color: #ddd;
				}

				@media screen and (max-width: 700px) {
					background: #222;
				}
			}
		}
	}
</style>
