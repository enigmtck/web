<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { appData, enigmatickWasm } from '../../stores';

	$: wasm = $enigmatickWasm;

	onMount(async () => {
		if (!wasm) {
			goto('/');
		}
	});

	async function handleProfile(event: any) {
		let data = new FormData(event.target);
		console.log('looking up: ' + data.get('address'));

		goto(`/${data.get('address')}`);
	}
</script>

<main>
	<form id="profile" method="POST" on:submit|preventDefault={handleProfile}>
		<label>
			<input type="text" id="address" name="address" placeholder="@address@server.url" />
		</label>
	</form>
</main>

<style lang="scss">
	* {
		font-family: 'Open Sans';
		transition-duration: 0.5s;
	}

	main {
		display: block;
		max-width: 600px;
		min-width: 400px;
		width: 100%;
		margin: 0 auto;
		grid-area: content;
		padding: 5px 5px 50px 5px;

		label {
			width: 100%;

			input {
				width: 100%;
				padding: 15px;
				border-radius: 15px;
				border: 0;
				outline: 1px solid #ccc;
				font-size: large;
				margin: 10px 0;
			}
		}

		@media screen and (max-width: 700px) {
			width: 100vw;
		}
	}

	:global(body.dark) {
		main {
			input {
				background: #222;
				color: white;
				outline: 1px solid #777;
			}
		}
	}
</style>
