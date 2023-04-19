<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { appData, enigmatickWasm, enigmatickOlm } from '../../stores';
	import { goto } from '$app/navigation';

	$: wasm = $enigmatickWasm;
	$: olm = $enigmatickOlm;

	let username = get(appData).username;

	onMount(() => {
		if (username) {
			goto(`/@${username}`);
		}
	});

	function checkPassword(): boolean {
		const password: HTMLInputElement = <HTMLInputElement>document.getElementsByName('password')[0];
		const confirm: HTMLInputElement = <HTMLInputElement>(
			document.getElementsByName('confirm_password')[0]
		);

		return password.value == confirm.value;
	}

	function checkPassphrase(): boolean {
		const passphrase: HTMLInputElement = <HTMLInputElement>(
			document.getElementsByName('passphrase')[0]
		);
		const confirm: HTMLInputElement = <HTMLInputElement>(
			document.getElementsByName('confirm_passphrase')[0]
		);

		return passphrase.value == confirm.value;
	}

	async function handleSignup(event: any) {
		const button: HTMLButtonElement = <HTMLButtonElement>document.getElementsByTagName('button')[0];

		button.disabled = true;

		if (event.target.checkValidity && checkPassword() && checkPassphrase()) {
			let data = new FormData(event.target);

			console.log(data);

			let olm_account = olm?.create_olm_account();

			if (olm_account) {
				let olm_identity_public_key = olm?.get_identity_public_key(olm_account);
				let olm_one_time_keys = olm?.get_one_time_keys(olm_account);

				if (
					data.get('username') &&
					data.get('display_name') &&
					data.get('password') &&
					data.get('passphrase') &&
					olm_identity_public_key &&
					olm_one_time_keys
				) {
					wasm
						?.create_user(
							String(data.get('username')),
							String(data.get('display_name')),
							String(data.get('password')),
							String(data.get('passphrase')),
							String(olm_identity_public_key),
							String(olm_one_time_keys.pickled_account)
						)
						.then((profile: any) => {
							goto('/login');
						});
				}
			}
		} else {
			console.error('FORM INVALID');
		}
	}
</script>

<main>
	<h1>ENIGMATICK</h1>
	<h2>Create Account</h2>
	<form id="signup" method="POST" on:submit|preventDefault={handleSignup}>
		<label>
			Username
			<input name="username" type="text" placeholder="bob" />
		</label>

		<label>
			Display Name
			<input name="display_name" type="text" placeholder="Bob Anderson" />
		</label>

		<label>
			Password
			<input
				name="password"
				type="password"
				on:change|preventDefault={checkPassword}
				required
				minlength="5"
				placeholder="Provides access to the server"
			/>
		</label>

		<label>
			Confirm Password
			<input
				name="confirm_password"
				type="password"
				on:change|preventDefault={checkPassword}
				required
				minlength="5"
				placeholder="Confirm your password"
			/>
		</label>

		<label>
			Passphrase
			<input
				name="passphrase"
				type="password"
				on:change|preventDefault={checkPassphrase}
				required
				minlength="5"
				placeholder="Encrypts private data stored on the server"
			/>
		</label>

		<label>
			Confirm Passphrase
			<input
				name="confirm_passphrase"
				type="password"
				on:change|preventDefault={checkPassphrase}
				required
				minlength="5"
				placeholder="Confirm your passphrase"
			/>
		</label>

		<div>
			<button>Create Account</button>
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
			background: #eee;

			@media screen and (max-width: 600px) {
				font-size: 13vw;
				background: #fafafa;
			}
		}

		h2 {
			font-family: 'Open Sans';
			font-weight: 300;
			font-size: 22px;
			background: #eee;
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
				font-weight: 600;
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

				button:disabled {
					opacity: 0.1;
					cursor: unset;
					background: darkred;
					color: whitesmoke;
				}
			}
		}
	}

	:global(body.dark) {
		@media screen and (max-width: 600px) {
			background: #222;
		}

		main {
			h1,
			h2 {
				color: whitesmoke;
				background: #222;

				@media screen and (max-width: 600px) {
					background: #222;
				}
			}

			form {
				background: #444;
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
