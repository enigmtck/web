<script lang="ts">
	export let links: Metadata[];
	import { cachedImage } from '../../../common';
	import { onDestroy, onMount } from 'svelte';
	import { enigmatickWasm } from '../../../stores';

	$: wasm = $enigmatickWasm;

	onMount(async () => {
		const { Buffer } = await import('buffer');
		window.Buffer = Buffer;
	});

	type Metadata = {
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
						src={cachedImage(wasm, window.Buffer, String(links[selectedIndex].ogImage))}
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
					display: block;
					font-size: 13px;
					padding-bottom: 5px;
					color: black;
					max-height: 100px;
					overflow: hidden;
					text-overflow: ellipsis;
				}
				span:first-child {
					white-space: nowrap;
					max-height: 22px;
					font-weight: 600;
					font-size: 16px;
					mask: unset;
				}
			}

			div:last-child {
				border-radius: 20px;
			}

			.image {
				min-width: unset;
				max-height: 30vh;
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
				}
			}
		}
	}
</style>
