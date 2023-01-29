<script lang="ts">
	import { get } from 'svelte/store';
	import { appData } from '../stores';
	import { page } from '$app/stores';
	import { Converter } from 'showdown';
	import init_wasm, {
		send_note,
		SendParams,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state
	} from 'enigmatick_olm';

	$: username = get(appData).username;
	$: display_name = get(appData).display_name;

	function update() {
		username = get(appData).username;
		display_name = get(appData).display_name;
		return true;
	}
</script>

<svelte:head>
	<style>
		@import url(https://fonts.bunny.net/css?family=almarai:300,400,700,800|open-sans:300,300i,400,400i,500,500i,600,600i,700,700i,800,800i|open-sans-condensed:300,300i,700);
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			display: grid;
			grid-template:
				[row1-start] 'header header header' [row1-end]
				[row2-start] 'left-aside content right-aside' [row2-end]
				/ 1fr auto 1fr;
		}
	</style>
</svelte:head>

{#if $page.url.pathname !== '/' && $page.url.pathname !== '/login' && $page.url.pathname !== '/signup'}
	<header>
		<div>
			<span class="title"><a href="/">ENIGMATICK</a></span>
		</div>
	</header>

	{#if update()}
		<slot />

		<nav>
			{#if username}
				<div>
					<a class={$page.url.pathname == '/@' + username ? 'selected' : ''} href="/@{username}"
						>{display_name}</a
					>
					<a class={$page.url.pathname == '/timeline' ? 'selected' : ''} href="/timeline"
						>Timeline</a
					>
					<a class={$page.url.pathname == '/search' ? 'selected' : ''} href="/search">Search</a>
					<a class={$page.url.pathname == '/settings' ? 'selected' : ''} href="/settings"
						>Settings</a
					>
				</div>
			{/if}
		</nav>
	{/if}
{:else}
	<slot />
{/if}

<style lang="scss">
	:global(a),
	:global(a:visited) {
		color: black;
	}

	:global(a:hover) {
		color: red;
		transition-duration: 0.5s;
	}

	header {
		grid-area: header;
		width: 100%;
		padding: 5px;
		background: white;
		color: darkred;
		text-align: center;
		font-family: 'Open Sans';
		font-size: 22px;
		font-weight: 600;

		a {
			color: darkred;
			text-decoration: none;
			transition-duration: 1s;
		}

		a:visited {
			color: darkred;
		}

		a:hover {
			color: red;
			transition-duration: 0.5s;
			text-decoration: none;
		}
	}

	:global(main) {
		grid-area: content;
		min-width: 600px;
		max-width: 700px;

		@media screen and (max-width: 600px) {
			min-width: unset;
			max-width: unset;
			width: 100vw;
		}
	}

	nav {
		grid-area: right-aside;

		@media screen and (max-width: 600px) {
			display: none;
		}

		div {
			width: 100%;
			padding: 20px;
			margin: 10px 20px;

			a {
				display: inline-block;
				width: 100%;
				text-decoration: none;
				font-family: 'Open Sans';
				font-size: 22px;
				padding: 5px;
				color: #222;
				transition-duration: 1s;
			}

			a:first-child {
				font-size: 28px;
				margin-bottom: 20px;
			}

			a:hover {
				color: red;
				transition-duration: 0.5s;
			}

			.selected {
				color: darkred;
				transition-duration: 1s;
			}
		}
	}
</style>
