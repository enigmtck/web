<script lang="ts">
	export let links: Metadata[];
	import { cachedContent } from '../../../common';
	import { onDestroy, onMount } from 'svelte';
	import { enigmatickWasm } from '../../../stores';

	$: wasm = $enigmatickWasm;

	onMount(async () => {});

	type Metadata = {
		url?: string | null;
		twitterTitle?: string | null;
		description?: string | null;
		ogDescription?: string | null;
		ogTitle?: string | null;
		ogImage?: string | null;
		ogSiteName?: string | null;
		twitterImage?: string | null;
		ogUrl?: string | null;
		twitterDescription?: string | null;
		published?: string | null;
		twitterSite?: string | null;
		ogType?: string | null;
	};

	let selectedIndex: number = 0;

	const imgError = (error: Event) => {
		console.log(error.target);
		let target = <HTMLElement>error.target;

		if (target) {
			target.style.display = 'none';
		}
	};
</script>

{#if links[selectedIndex].ogUrl && links[selectedIndex].ogTitle}
	<a href={links[selectedIndex].ogUrl} target="_blank" rel="noreferrer">
		<div>
			{#if links[selectedIndex].ogImage?.length}
				<div class="image">
					<img
						src={cachedContent(wasm, String(links[selectedIndex].ogImage))}
						alt="Link Preview"
						on:error={imgError}
					/>
				</div>
			{/if}
			<div>
				<span>{links[selectedIndex].ogTitle}</span>

				{#if links[selectedIndex].ogDescription}
					<!-- @html can be used below to render embedded HTML, but I need to sanitize that first -->
					<!-- <span>{@html links[selectedIndex].ogDescription}</span> -->
					<span>{links[selectedIndex].ogDescription}</span>
				{/if}

				{#if links[selectedIndex].ogSiteName}
					<span>{links[selectedIndex].ogSiteName}</span>
				{/if}
			</div>
		</div>
	</a>
{/if}

<style lang="scss">
	a {
		width: 100%;
		display: block;

		div {
			width: 100%;
			display: flex;
			flex-direction: column;
			border: 1px solid #eee;
			background: #fafafa;
			border-radius: 20px;

			div {
				min-width: 60%;
				border: 0;
				padding: 20px;
				display: flex;
				overflow: hidden;
				flex-direction: column;
				border-radius: 20px 20px 0 0;

				span {
					font-size: 13px;
					color: black;
					overflow: hidden;
					text-overflow: ellipsis;
					display: -webkit-box;
					-webkit-box-orient: vertical;
					-webkit-line-clamp: 2;
				}
				span:first-child {
					font-weight: 600;
					font-size: 16px;
					margin-bottom: 10px;
					mask: unset;
					color: maroon;
				}

				span:last-child {
					font-weight: 600;
					font-size: 16px;
					margin-top: 10px;
					color: #999;
				}
			}

			div:last-child {
				border-radius: 20px;
				text-overflow: ellipsis;
			}

			.image {
				min-width: unset;
				max-height: 25vh;
				width: 100%;
				padding: 0;
				margin: 0;
				display: flex;
				align-items: center;
				justify-content: center;

				img {
					width: unset;
					height: unset;
					clip-path: unset;
					width: 100%;
					border: 0;
				}
			}
		}
	}

	:global(body.dark) {
		a {
			div {
				background: #151515;
				border: 1px solid #222;

				div {
					border: 0;

					span {
						color: white;
					}
					span:first-child {
						color: #aaa;
					}
					span:last-child {
						color: #444;
					}
				}
			}
		}
	}
</style>
