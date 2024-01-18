<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, appData } from '../../stores';
	import init, {
		load_instance_information,
		upload_avatar,
		upload_banner,
		update_password,
		get_state,
		import_state
	} from 'enigmatick_wasm';

	let username = get(appData).username;
	let display_name = get(appData).display_name;

	onMount(() => {
		if (username) {
			init().then(() => {
				load_instance_information().then((instance) => {
					console.log(instance?.domain);
					console.log(instance?.url);

					if (get(wasmState)) {
						import_state(get(wasmState));
						console.log('loaded state from store');
						console.log(get(wasmState));
					}
					console.log('init WASM');
				});
			});
		}
	});

	function handlePasswordChange(event: any) {
		let data = new FormData(event.target);

		let current = data.get('current_password');
		let updated = data.get('new_password');
		let confirm = data.get('confirm_password');

		if (current && updated && confirm && updated === confirm) {
			console.log(current + ' ' + updated + ' ' + confirm);

			update_password(String(current), String(updated)).then((x) => {
				if (x) {
					<HTMLFormElement>(event.target).reset();
				} else {
					failure.showModal();
				}
			});
		}
	}

	let failure: HTMLDialogElement;
</script>

<main>
	<dialog bind:this={failure}>
		<form method="dialog">
			<h3>Password Update Failed</h3>
			<p>
				Something went wrong. Check your current password and try again.
			</p>
			<button>Okay</button>
		</form>
	</dialog>

	<form id="change_password" method="POST" on:submit|preventDefault={handlePasswordChange}>
		<h3>Change Password</h3>
		<label>
			Current Password
			<input name="current_password" type="password" placeholder="Current Password" />
		</label>

		<label>
			New Password
			<input name="new_password" type="password" placeholder="Use a Password Manager" />
		</label>

		<label>
			Confirm New Password
			<input name="confirm_password" type="password" placeholder="Confirm Password" />
		</label>

		<button>Update</button>
	</form>
</main>

<style lang="scss">
	:global(li) {
		padding: 5px 0;
	}

	:global(pre) {
		padding: 10px;
		line-height: 1.75em;
		word-wrap: normal;
		white-space: pre-wrap;
	}

	:global(code) {
		display: inline;
		font-size: 14px;
		padding: 3px;
		border-radius: 4px;
		background: #f5f5f5;
	}

	:global(a),
	:global(a:visited) {
		color: black;
	}

	:global(a:hover) {
		color: red;
		transition-duration: 0.5s;
	}

	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: top;
		height: 100vh;

		button {
			background: darkred;
			color: whitesmoke;
			transition-duration: 1s;
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
			transition-duration: 1s;
			cursor: pointer;
		}

		p {
			font-family: 'Open Sans';
			font-size: 14px;
		}

		dialog {
			padding: 0;
			border: 1px solid #ccc;
			border-radius: 10px;

			form {
				margin: 0;
			}
		}

		form {
			display: flex;
			flex-direction: column;
			max-width: 600px;
			text-align: center;
			background: #ddd;
			padding: 10px 20px;
			margin: 10px 0;
			border-radius: 10px;

			h3 {
				font-family: 'Open Sans';
				font-size: 20px;
				font-weight: 600;
				padding: 0 0 5px 0;
				margin: 0;
			}

			label {
				width: 100%;
				padding: 5px 0;
				font-family: 'Open Sans';
				font-size: 14px;
				text-align: left;

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
		}
	}
	:global(body.dark) {
		main {
			color: white;

			h3 {
				color: whitesmoke;
			}

			dialog {
				border-color: #555;
			}

			form {
				background: #222;

				p {
					color: #ddd;
				}
			}
		}
	}
</style>
