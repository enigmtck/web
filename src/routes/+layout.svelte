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

	function handleComposeSubmit(event: any) {
		console.log(event);
	}

	function convertToMarkdown(data: string) {
		let converter = new Converter();
		converter.setFlavor('github');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeMarkdown(data);
	}

	function convertToHtml(data: string) {
		let converter = new Converter();
		converter.setFlavor('github');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeHtml(data);
	}

	function captureChanges() {
		let compose = document.getElementById('compose');

		if (compose) {
			markdown_note = compose.innerText;
			html_note = convertToHtml(markdown_note);
		}
	}

	function handlePreview() {
		captureChanges();

		preview = !preview;
	}

	function handlePublish() {
		captureChanges();

		let params = SendParams.new().set_kind('Note').set_content(html_note);

		send_note(params).then((x) => {
			if (x) {
				console.log('send successful');
			} else {
				console.log('send unsuccessful');
			}
		});
	}

	let markdown_note = '';
	let html_note = '';
	let preview = false;
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
		<aside>
			{#if username}
				{#if $page.url.pathname === '/timeline'}
					<div>
						<h1>Write</h1>
						{#if !preview}
							<pre id="compose" contenteditable="true">{markdown_note}</pre>
						{:else}
							<div>{@html html_note}</div>
						{/if}

						<form method="POST" on:submit|preventDefault={handleComposeSubmit}>
							<span>
								<i class="fa-solid fa-paperclip" />
								{#if preview}
									<i class="fa-solid fa-pen-nib" on:click|preventDefault={handlePreview} />
								{:else}
									<i class="fa-solid fa-eye" on:click|preventDefault={handlePreview} />
								{/if}
							</span>
							<button on:click|preventDefault={handlePublish}>Publish</button>
						</form>
					</div>
				{/if}
			{/if}
		</aside>

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

	aside {
		grid-area: left-aside;
		height: calc(100vh - 40px);
		text-align: right;

		@media screen and (max-width: 600px) {
			display: none;
		}

		div {
			display: inline-block;
			max-width: 400px;
			min-width: 350px;
			margin: 10px;
			padding: 0;

			h1 {
				width: 100%;
				text-align: right;
				font-family: 'Open Sans';
				font-size: 28px;
				font-weight: 400;
				margin: 5px 0;
			}

			pre,
			div {
				text-align: left;
				width: 100%;
				padding: 10px;
				margin: 0;
				background: white;
				min-height: 150px;
				border-top: 1px solid #ccc;
				border-bottom: 1px solid #ccc;
				font-family: 'Open Sans';
			}

			div {
				padding: 0 10px;
			}

			form {
				padding: 5px;
				text-align: right;

				span {
					display: inline-block;
					width: calc(100% - 110px);
					text-align: left;

					i {
						font-size: 24px;
						transition-duration: 1s;
						padding: 0 10px;
					}

					i:hover {
						cursor: pointer;
						transition-duration: 0.5s;
						color: red;
					}
				}

				button {
					display: inline-block;
					margin: 5px;
					padding: 5px 15px;
					background: darkred;
					color: whitesmoke;
					transition-duration: 1s;
					border: 0;
					font-family: 'Open Sans';
					font-size: 18px;
					font-weight: 600;
				}

				button:hover {
					color: darkred;
					background: whitesmoke;
					transition-duration: 1s;
					cursor: pointer;
				}
			}
		}
	}

	:global(main) {
		grid-area: content;
		min-width: 600px;
		max-width: 800px;

		@media screen and (max-width: 600px) {
			min-width: unset;
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
			border-left: 1px solid #ccc;

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
