<script lang="ts">
	import { get } from 'svelte/store';
	import { wasmState, appData, enigmatickWasm } from '../../stores';
	import { goto } from '$app/navigation';

	$: wasm = $enigmatickWasm;

	let username = get(appData).username;

	if (username) {
		goto('/@' + username).then(() => {
			console.log('logged in');
		});
	}

	function handleLogin(event: any) {
		let data = new FormData(event.target);
		console.log('clicked');

		wasm
			?.authenticate(String(data.get('username')), String(data.get('password')))
			.then((profile: any) => {
				if (profile) {
					const instanceData = wasm?.load_instance_information().then((instance) => {
						appData.set({
							username: String(profile?.username),
							display_name: String(profile?.display_name),
							avatar: String(profile?.avatar_filename),
							domain: instance?.domain || null,
							url: instance?.url || null
						});
						username = get(appData).username;

						wasmState.set(String(wasm?.get_state().export()));
						/* 						let data = JSON.stringify({
							pickled_account: x.get_olm_pickled_account(),
							olm_sessions: JSON.parse(x.get_olm_sessions())
						});
						console.log(get(wasmState)); */

						goto('/@' + username).then(() => {
							console.log('logged in');
						});
					});
				} else {
					console.debug('authentication failed');
					failure.showModal();
				}
			});
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
			<input name="password" type="password" placeholder="Provides access to the server" />
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

			@media screen and (max-width: 600px) {
				background: #fafafa;
			}
		}
	</style>
</svelte:head>

<style lang="scss">
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		max-width: unset;
		grid-area: content;

		@media screen and (max-width: 600px) {
			height: unset;
		}

		h1 {
			font-family: 'Open Sans';
			font-size: 5vw;
			text-align: center;
			font-weight: 300;
			color: darkred;
			padding: 0;
			margin: 0;
			width: 100%;
			background: inherit;

			@media screen and (max-width: 600px) {
				font-size: 13vw;
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

			@media screen and (max-width: 600px) {
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
		@media screen and (max-width: 600px) {
			background: #222;
		}

		main {
			h1 {
				color: whitesmoke;
				background: #000;
			}

			h3 {
				color: whitesmoke;
			}

			dialog {
				border-color: #555;
			}

			form {
				background: #222;
				outline: 0;
				label {
					color: #ddd;
				}

				p {
					color: #ddd;
				}

				@media screen and (max-width: 600px) {
					background: #222;
				}
			}
		}
	}
</style>
