<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { appData, enigmatickWasm } from '../../stores';
	import { goto } from '$app/navigation';

	$: wasm = $enigmatickWasm;

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

	async function handleSignup(event: any) {
		const button: HTMLButtonElement = <HTMLButtonElement>document.getElementsByTagName('button')[0];

		button.disabled = true;

		if (event.target.checkValidity && checkPassword()) {
			let data = new FormData(event.target);

			console.log(data);

			if (data.get('username') && data.get('display_name') && data.get('password')) {
				wasm
					?.create_user(
						String(data.get('username')),
						String(data.get('display_name')),
						String(data.get('password'))
					)
					.then((profile: any) => {
						goto('/login');
					});
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
				placeholder="Use a password manager"
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

			@media screen and (max-width: 700px) {
				background: #fafafa;
			}
		}
	</style>
</svelte:head>

<style lang="scss">
	main {
		position: fixed;
		top: calc(50% - 300px);
		left: calc(50% - 200px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0;
		width: 400px;
		height: 600px;
		//width: 100%;
		//height: 100%;
		max-width: unset;
		grid-area: content;

		@media screen and (max-width: 700px) {
			height: 100%;
			top: 0;
		}

		h1 {
			font-family: 'Open Sans';
			font-size: 5vw;
			text-align: center;
			font-weight: 300;
			color: darkred;
			padding: 0;
			margin: 0;
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

			@media screen and (max-width: 700px) {
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
		main {
			h1,
			h2 {
				color: whitesmoke;
				background: #222;
			}

			form {
				background: #444;
				outline: 0;
				label {
					color: #ddd;
				}
			}
		}

		@media screen and (max-width: 700px) {
			main {
				background: #222;

				h1, h2, form { background: #222; }
			}
		}
	}
</style>
