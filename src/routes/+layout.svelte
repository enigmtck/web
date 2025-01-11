<script lang="ts">
	import { get } from 'svelte/store';
	import { appData, wasmState, enigmatickWasm } from '../stores';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, setContext } from 'svelte';

	$: username = $appData.username;
	$: display_name = $appData.display_name;
	$: avatar = $appData.avatar;
	$: wasm = $enigmatickWasm;

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
			console.log('importing wasm');
			wasm = await import('enigmatick_wasm');
			await wasm.default();

			let instance = await wasm.load_instance_information();
			console.log(instance?.domain);
			console.log(instance?.url);

			if (get(wasmState)) {
				wasm.import_state(get(wasmState));
				console.log('loaded state from store');
			}

			console.log(wasm);
			enigmatickWasm.set(wasm);
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
		//wasm = $enigmatickWasm;
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
		<slot />

		<!-- <div class="context">
			<ul>
				<li>
					<div class="toggle">
						<label>
							<input type="checkbox" id="theme" on:change|preventDefault={darkMode} />
							<span class="slider" />
						</label>
					</div>
				</li>
			</ul>
		</div> -->

		<footer>
			{#if username}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<a class={$page.url.pathname == `/@${username}` ? 'selected' : ''} href={`/@${username}`}
					><i
						class="fa-solid fa-user {$page.url.pathname == '/@' + username ? 'selected' : ''}"
					/></a
				>
			{:else}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<a class={$page.url.pathname == '/login' ? 'selected' : ''} href="/login"
					><i
						class="fa-solid fa-right-to-bracket {$page.url.pathname == '/login' ? 'selected' : ''}"
					/></a
				>
			{/if}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<a class={$page.url.pathname == '/timeline' ? 'selected' : ''} href="/timeline"
				><i
					class="fa-solid fa-newspaper {$page.url.pathname == '/timeline' ? 'selected' : ''}"
				/></a
			>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<a class={$page.url.pathname == '/search' ? 'selected' : ''} href="/search"
				><i
					class="fa-solid fa-magnifying-glass {$page.url.pathname == '/search' ? 'selected' : ''}"
				/></a
			>
		</footer>

		<nav class="top">
			<div>
				<span class="title"><a href="/">ENIGMATICK</a></span>
				{#if avatar}
					<span class="avatar"><a href="/@{username}"><img src={avatar} alt="You" /></a></span>
				{/if}
			</div>

			<div>
				<a class={$page.url.pathname == '/timeline' ? 'selected' : ''} href="/timeline"
					><i class="fa-solid fa-newspaper" />Timeline</a
				>
				<!-- {#if username}
					<a class={$page.url.pathname == '/message' ? 'selected' : ''} href="/message"
						><i class="fa-solid fa-inbox" />Messages</a
					>
				{/if} -->
				{#if username}
					<a class={$page.url.pathname == '/search' ? 'selected' : ''} href="/search"
						><i class="fa-solid fa-magnifying-glass" />Search</a
					>
				{/if}
				{#if username}
					<a class={$page.url.pathname == '/settings' ? 'selected' : ''} href="/settings"
						><i class="fa-solid fa-gear" />Settings</a
					>
				{:else}
					<a class={$page.url.pathname == '/login' ? 'selected' : ''} href="/login"
						><i class="fa-solid fa-right-to-bracket" />Login</a
					>
				{/if}
				<a class={$page.url.pathname == '/test' ? 'selected' : ''} href="/test"
					><i class="fa-solid fa-gear" />TEST</a
				>
			</div>

			<div class="toggle">
				<label>
					<input type="checkbox" id="theme" on:change|preventDefault={darkMode} />
					<span class="slider" />
				</label>
			</div>
		</nav>
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
		position: relative;
		background: #eee;
	}

	:global(body.dark) {
		background: var(--container-dark-background);
	}

	.title {
		text-align: center;
	}

	.app {
		width: 100%;
		height: 100%;
		position: relative;
		display: grid;
		grid-template:
			[row1-start] 'left-aside content' auto [row2-end]
			/ 250px auto;

		@media screen and (max-width: 1000px) {
			grid-template:
				[row1-start] 'left-aside content' auto [row2-end]
				/ 250px auto;
		}

		@media screen and (max-width: 700px) {
			grid-template:
				[row1-start] 'left-aside content' auto [row2-end]
				/ 0 auto;
		}

		nav.top {
			grid-area: left-aside;
			background: #eee;

			@media screen and (max-width: 700px) {
				display: none;
			}

			div {
				width: calc(100% - 20px);
				padding: 0;
				margin: 10px;

				a {
					display: inline-block;
					width: 100%;
					text-decoration: none;
					font-family: 'Open Sans';
					font-size: 14px;
					padding: 10px 5px;
					color: #222;
					border-radius: 20px;
				}

				a:hover {
					color: red;
				}

				a > i {
					padding: 0 15px;
				}

				.selected {
					background: #ddd;
				}
				span.title {
					a {
						font-size: 24px;
						color: darkred;
					}

					a:hover {
						color: red;
					}
				}

				span.avatar {
					width: 100%;
					display: inline-block;

					a {
						position: relative;
						display: inline-block;
						text-align: center;
						width: 100%;
						height: 41px;

						img {
							display: inline-block;
							width: 75px;
							height: auto;
							margin: 3px 10px;
							clip-path: inset(0 0 0 0 round 20%);
						}
					}
				}
			}

			.toggle {
				position: relative;
				margin: 20px auto;
				padding: 0;
				width: 50px;
				height: 24px;

				label {
					position: relative;
					display: inline-block;
					width: 100%;
					height: 25px;
					background-color: #555;
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
					background-color: #555;
					transition: 0.3s;
				}

				input:checked ~ .slider::before {
					transform: translateX(25px);
					background-color: var(--dark);
					box-shadow: none;
				}
			}
		}

		slot {
			grid-area: content;
			position: relative;
		}

		.context {
			grid-area: right-aside;

			@media screen and (max-width: 1000px) {
				display: none;
			}

			ul {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: row;
				justify-content: space-evenly;
				width: 100%;
			}

			img:hover {
				opacity: 0.8;
			}

			div {
				margin: 0 10px;
				border-radius: 10px;

				h1 {
					font-family: 'Open Sans';
					color: #999;
					font-size: 14px;
					padding: 5px;
					border-radius: 10px 10px 0 0;
					font-weight: 500;

					i {
						padding: 0 10px 0 5px;
						font-size: 14px;
					}
				}

				ul {
					width: 100%;
					padding: 0 10px 10px 10px;

					li {
						font-family: 'Open Sans';
						font-size: 13px;
						width: 100%;
					}
				}
			}

			div.notifications h1 i {
				color: goldenrod;
			}

			div.trending h1 i {
				color: lightblue;
			}
		}

		footer {
			display: none;

			@media screen and (max-width: 700px) {
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

				a {
					display: inline-block;
					text-decoration: none;
					font-family: 'Open Sans';
					font-size: 14px;
					padding: 10px 20px;
					color: #222;
					border-radius: 20px;
				}

				a > i {
					padding: 0 15px;
				}

				a:hover i {
					color: red;
				}

				.selected {
					background: #eee;
				}
			}
		}
	}

	:global(body.dark) {
		.app {
			nav.top {
				background: #000;

				div {
					a {
						border-radius: 20px;
						color: #aaa;
					}

					a:hover {
						color: red;
					}

					.selected {
						background: #222;
					}

					span.title {
						a {
							color: #fff;
						}
					}
				}

				.toggle {
					label {
						outline: 1px solid #777;
					}
				}
			}

			.context {
				color: white;
				background: #000;
			}

			footer {
				background: #000;

				a {
					color: #222;
				}

				a > i {
					color: #eee;
				}

				.selected {
					background: #222;
				}
			}
		}
	}
</style>
