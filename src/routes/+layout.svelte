<script lang="ts">
	import { get } from 'svelte/store';
	import { appData, wasmState, enigmatickWasm, enigmatickOlm } from '../stores';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, setContext } from 'svelte';

	$: username = $appData.username;
	$: display_name = $appData.display_name;
	$: avatar = $appData.avatar;
	$: wasm = $enigmatickWasm;
	$: olm = $enigmatickOlm;

	onMount(async () => {
		const theme = localStorage.getItem('theme');

		if (theme && theme === 'dark') {
			setDark();
		} else if (theme && theme === 'light') {
			setLight();
		} else {
			setDark();
		}

		if (!wasm) {
			wasm = await import('enigmatick_wasm');
			await wasm.default();

			let instance = await wasm.load_instance_information();
			console.log(instance?.domain);
			console.log(instance?.url);

			if (get(wasmState)) {
				wasm.import_state(get(wasmState));
				console.log('loaded state from store');
			}

			enigmatickWasm.set(wasm);
		}

		if (!olm) {
			olm = await import('enigmatick_olm');
			await olm.default();
			enigmatickOlm.set(olm);
		}
	});

	function isDark() {
		let body = document.getElementsByTagName('body')[0];
		if (body && body.classList.contains('dark')) {
			return true;
		} else {
			return false;
		}
	}

	function setDark() {
		let body = document.getElementsByTagName('body')[0];
		let control = document.getElementById('theme') as HTMLInputElement | null;
		if (body && !body.classList.contains('dark')) {
			body.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		}

		if (control) {
			control.checked = false;
		}
	}

	function setLight() {
		let body = document.getElementsByTagName('body')[0];
		let control = document.getElementById('theme') as HTMLInputElement | null;
		if (body && body.classList.contains('dark')) {
			body.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}

		if (control) {
			control.checked = true;
		}
	}

	function update() {
		username = $appData.username;
		display_name = $appData.display_name;
		avatar = $appData.avatar;
		wasm = $enigmatickWasm;
		return true;
	}

	function darkMode(event: any) {
		if (isDark()) {
			setLight();
		} else {
			setDark();
		}
	}
</script>

<svelte:head>
	<style>
		@font-face {
			font-family: 'Open Sans';
			src: URL('/fonts/OpenSans-Light.ttf');
			font-weight: 300;
		}

		@font-face {
			font-family: 'Open Sans';
			src: URL('/fonts/OpenSans-Regular.ttf');
			font-weight: 400;
		}

		@font-face {
			font-family: 'Open Sans';
			src: URL('/fonts/OpenSans-Medium.ttf');
			font-weight: 500;
		}

		@font-face {
			font-family: 'Open Sans';
			src: URL('/fonts/OpenSans-SemiBold.ttf');
			font-weight: 600;
		}

		@font-face {
			font-family: 'Open Sans';
			src: URL('/fonts/OpenSans-Bold.ttf');
			font-weight: 700;
		}

		* {
			box-sizing: border-box;
		}

		html {
			margin: 0;
			padding: 0;
			height: 100%;
		}

		body {
			margin: 0;
			padding: 0;
			height: 100%;
		}
	</style>
</svelte:head>

<div class="app">
	{#if $page.url.pathname !== '/' && $page.url.pathname !== '/login' && $page.url.pathname !== '/signup'}
		<header>
			<div>
				<span class="title"><a href="/">ENIGMATICK</a></span>
			</div>
			<nav>
				{#if avatar}
					<a href="/@{username}"><img src="/{avatar}" alt="You" /></a>
				{/if}
				<div class="toggle">
					<label>
						<input type="checkbox" id="theme" on:change|preventDefault={darkMode} />
						<span class="slider" />
					</label>
				</div>
			</nav>
		</header>

		<slot />

		{#if username}
			<footer>
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-house {$page.url.pathname == '/@' + username ? 'selected' : ''}"
					on:click={async () => {
						await goto(`/@${username}`);
					}}
				/>
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-earth-americas {$page.url.pathname == '/timeline' ? 'selected' : ''}"
					on:click={async () => {
						await goto('/timeline');
					}}
				/>
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-magnifying-glass {$page.url.pathname == '/search' ? 'selected' : ''}"
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
	{:else}
		<slot />
	{/if}
</div>

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

	.app {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template:
			[row1-start] 'header header header header header' 41px [row1-end]
			[row2-start] 'left-gutter left-aside content right-aside right-gutter' [row2-end]
			/ 1fr auto auto auto 1fr;

		header {
			z-index: 25;
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

				i.selected {
					color: red;
				}
			}
		}
	}

	:global(body.dark) {
		footer {
			background: #222;

			i {
				color: #fafafa;
			}

			i.selected {
				color: darkred;
			}
		}
	}

	:global(body div > nav) {
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
		.app {
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
	}

	:global(body.dark) {
		.app {
			header {
				background: #222;

				a {
					color: whitesmoke;
				}
			}
		}
	}
</style>
