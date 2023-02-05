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

	function dark_mode(event: any) {
		console.log(event);
		let body = document.getElementsByTagName("body")[0];
		body?.classList.toggle("dark");
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
		<div class="toggle">
			<label>
				<input type="checkbox" on:change|preventDefault="{dark_mode}"/>
				<span class="slider" />
			</label>
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

	:root {
		--light: white;
		--dark: #28292c;
		--container-background: #fff;
		--container-dark-background: #000;
	}

	:global(body) {
		background: var(--container-background);
		transition-duration: 1s;
	}

	:global(body.dark) {
		background: var(--container-dark-background);
	}
	
	header {
		position: relative;
		grid-area: header;
		width: 100%;
		padding: 5px;
		background: #fefefe;
		border-bottom: 1px solid #eee;
		color: darkred;
		text-align: center;
		font-family: 'Open Sans';
		font-size: 22px;
		font-weight: 600;
		transition-duration: 1s;

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

		.toggle {
			position: absolute;
			top: 8px;
			right: 40px;
			width: 50px;
		}

		label {
			position: absolute;
			width: 100%;
			height: 24px;
			background-color: var(--dark);
			outline: 1px solid #ccc;
			border-radius: 50px;
			cursor: pointer;
		}

		input {
			position: absolute;
			display: none;
		}

		.slider {
			position: absolute;
			left: 0px;
			width: 100%;
			height: 100%;
			border-radius: 50px;
			transition: 0.3s;
		}

		input:checked ~ .slider {
			background-color: var(--light);
		}

		.slider::before {
			content: '';
			position: absolute;
			top: 3px;
			left: 4px;
			width: 18px;
			height: 18px;
			border-radius: 50%;
			box-shadow: inset 7px -4px 0px 0px var(--light);
			background-color: var(--dark);
			transition: 0.3s;
		}

		input:checked ~ .slider::before {
			transform: translateX(25px);
			background-color: var(--dark);
			box-shadow: none;
		}
	}

	:global(body.dark) {
		header {
			background: #000;
			border-bottom: 1px solid #222;

			a {
				color: whitesmoke;
			}
		}
	}

	:global(main) {
		grid-area: content;
		min-width: 400px;
		max-width: 600px;

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

	:global(body.dark) {
		nav {
			a {
				color: #aaa;
			}

			a:hover {
				color: red;
			}

			.selected {
				color: white;
			}
		}
	}
</style>
