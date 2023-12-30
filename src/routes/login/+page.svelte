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
			?.authenticate(
				String(data.get('username')),
				String(data.get('password'))
			)
			.then((profile: any) => {
				const instanceData = wasm?.load_instance_information().then((instance) => {
					appData.set({
						username: String(profile?.username),
						display_name: String(profile?.display_name),
						avatar: String(profile?.avatar_filename),
						domain: instance?.domain || null,
						url: instance?.url || null
					});
					username = get(appData).username;
					wasm?.get_state().then((x: any) => {
						//console.log(x);
						wasmState.set(x.export());
/* 						let data = JSON.stringify({
							pickled_account: x.get_olm_pickled_account(),
							olm_sessions: JSON.parse(x.get_olm_sessions())
						});
						console.log(get(wasmState)); */

						goto('/@' + username).then(() => {
							console.log('logged in');
						});
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

		<div>
			<button>Sign In</button>
		</div>
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
		@media screen and (max-width: 600px) {
			background: #222;
		}

		main {
			h1 {
				color: whitesmoke;
				background: #000;
			}

			form {
				background: #222;
				outline: 0;
				label {
					color: #ddd;
				}

				@media screen and (max-width: 600px) {
					background: #222;
				}
			}
		}
	}
</style>
