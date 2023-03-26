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
	import { goto } from '$app/navigation';

	$: username = get(appData).username;
	$: display_name = get(appData).display_name;
	$: avatar = get(appData).avatar;

	function update() {
		username = get(appData).username;
		display_name = get(appData).display_name;
		avatar = get(appData).avatar;
		return true;
	}

	function dark_mode(event: any) {
		console.log(event);
		let body = document.getElementsByTagName('body')[0];
		body?.classList.toggle('dark');
	}
</script>

<svelte:head>
	<style>
		@import url(https://fonts.bunny.net/css?family=almarai:300,400,700,800|open-sans:300,300i,400,400i,500,500i,600,600i,700,700i,800,800i|open-sans-condensed:300,300i,700);
		* {
			box-sizing: border-box;
		}

		html {
			margin: 0;
			padding: 0;
		}

		body {
			margin: 0;
			padding: 0;
			display: grid;
			grid-template:
				[row1-start] 'header header header header header' [row1-end]
				[row2-start] 'left-gutter left-aside content right-aside right-gutter' [row2-end]
				/ 1fr auto auto auto 1fr;
		}
	</style>
</svelte:head>

{#if $page.url.pathname !== '/' && $page.url.pathname !== '/login' && $page.url.pathname !== '/signup'}
	<header>
		<div>
			<span class="title"><a href="/">ENIGMATICK</a></span>
		</div>
		<nav>
			{#if avatar}
				<a href="/@{username}"><img src="/{avatar}" /></a>
			{/if}
			<div class="toggle">
				<label>
					<input type="checkbox" on:change|preventDefault={dark_mode} checked={true} />
					<span class="slider" />
				</label>
			</div>
		</nav>
	</header>

	{#if update()}
		<slot />

		{#if username}
			<footer>
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-earth-americas"
					on:click={async () => {
						await goto('/timeline');
					}}
				/>
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-house"
					on:click={async () => {
						await goto(`/@${username}`);
					}}
				/>
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-magnifying-glass"
					on:click={async () => {
						await goto('/search');
					}}
				/>
			</footer>

			<nav>
				<div>
					<a class={$page.url.pathname == '/timeline' ? 'selected' : ''} href="/timeline"
						><i class="fa-solid fa-earth-americas" />Timeline</a
					>
					<a class={$page.url.pathname == '/message' ? 'selected' : ''} href="/message"
						><i class="fa-solid fa-inbox" />Messages</a
					>
					<a class={$page.url.pathname == '/search' ? 'selected' : ''} href="/search"
						><i class="fa-solid fa-magnifying-glass" />Search</a
					>
					<a class={$page.url.pathname == '/settings' ? 'selected' : ''} href="/settings"
						><i class="fa-solid fa-gear" />Settings</a
					>
					<a class={$page.url.pathname == '/test' ? 'selected' : ''} href="/test"
						><i class="fa-solid fa-gear" />TEST</a
					>
				</div>
			</nav>
		{/if}
	{/if}
{:else}
	<slot />
{/if}

<style lang="scss">
	:global(a),
	:global(a:visited) {
		color: darkred;
		text-decoration: none;
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
		transition-duration: 0.5s;
		position: relative;
		background: #eee;
	}

	:global(body.dark) {
		background: var(--container-dark-background);
		background: #222;
	}

	header {
		z-index: 30;
		position: fixed;
		width: 100%;
		padding: 0;
		background: #eee;
		color: darkred;
		text-align: center;
		font-family: 'Open Sans';
		font-size: 22px;
		font-weight: 600;
		grid-area: header;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		grid-template-areas: 'left center right';
		align-items: center;

		> div {
			grid-area: center;
			display: inline-block;

			a {
				color: darkred;
				text-decoration: none;
			}

			a:visited {
				color: darkred;
			}

			a:hover {
				color: red;
				text-decoration: none;
			}
		}

		nav {
			grid-area: right;
			display: flex;
			flex-direction: row-reverse;
			align-items: center;
			margin: 0;
			width: 100%;

			a {
				position: relative;
				display: inline-block;
				width: auto;
				height: 41px;

				img {
					display: inline-block;
					width: 35px;
					height: auto;
					margin: 3px 10px;
					clip-path: inset(0 0 0 0 round 50%);
				}
			}

			img:hover {
				opacity: 0.8;
			}

			.toggle {
				position: relative;
				margin: 8px;
				padding: 0;
				width: 50px;
				height: 24px;
			}

			label {
				position: relative;
				display: inline-block;
				width: 100%;
				height: 25px;
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
	}

	:global(body.dark) {
		header {
			background: #222;

			a {
				color: whitesmoke;
			}
		}
	}

	:global(main) {
		margin-top: 41px;
		grid-area: content;
		min-width: 400px;
		max-width: 700px;

		@media screen and (max-width: 600px) {
			min-width: unset;
			max-width: unset;
			width: 100vw;
		}
	}

	footer {
		display: none;

		@media screen and (max-width: 600px) {
			background: #eee;
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: space-evenly;
			position: fixed;
			bottom: 0;
			left: 0;
			width: 100vw;
			height: 50px;

			i {
				color: #222;
				font-size: 26px;
				margin: 0 20px;
			}

			i:hover {
				color: red;
			}
		}
	}

	:global(body.dark) {
		footer {
			background: #222;

			i {
				color: #fafafa;
			}

			i:hover {
				color: red;
			}
		}
	}

	:global(body div > nav) {
		margin-top: 41px;
		height: calc(100vh - 41px);
		max-width: 170px;
		grid-area: right-aside;
		background: #eee;

		@media screen and (max-width: 600px) {
			display: none;
		}

		div {
			width: 100%;
			padding: 0;
			margin: 10px;

			img {
				width: 40px;
			}

			a {
				display: inline-block;
				width: 100%;
				text-decoration: none;
				font-family: 'Open Sans';
				font-size: 18px;
				padding: 5px;
				color: #222;
			}

			a:hover {
				color: red;
			}

			a > i {
				padding: 0 15px;
			}

			.selected {
				color: darkred;
			}
		}
	}

	:global(body.dark) {
		nav {
			background: #222;
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
