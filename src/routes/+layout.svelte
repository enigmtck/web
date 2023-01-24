<script lang="ts">
	import { get } from 'svelte/store';
	import { appData } from '../stores';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

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
				/ 1fr minmax(200px, 800px) 1fr;
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
		{#if username}
			<aside><div></div></aside>
		{/if}

		<slot />

		{#if username}
			<nav>
				<div>
					<a href="/@{username}">{display_name}</a>
					<a href="/timeline">Timeline</a>
					<a href="/search">Search</a>
					<a href="/settings">Settings</a>
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
		background: #222;
		color: #eee;
		text-align: center;
		font-family: 'Open Sans';
		font-size: 22px;
		font-weight: 600;

		a {
			color: #eee;
			text-decoration: none;
			transition-duration: 1s;
		}

		a:visited {
			color: #eee;
		}

		a:hover {
			color: red;
			transition-duration: 0.5s;
			text-decoration: none;
		}

		@media screen and (max-width: 600px) {
			text-align: left;
		}
	}

	aside {
		grid-area: left-aside;
	}

	slot {
		grid-area: content;
	}

	nav {
		@media screen and (max-width: 600px) {
			display: none;
		}

		grid-area: right-aside;

		div {
			width: 100%;
			padding: 20px;
			margin: 10px 20px;
			border-left: 1px solid #ccc;

			a {
				display: inline-block;
				width: 100%;
				text-decoration: none;
				font-family: "Open Sans";
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
		}
	}
</style>
