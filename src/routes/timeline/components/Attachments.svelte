<script lang="ts">
	import type { Article, Note, Question } from '../../../common';
	import { cachedContent } from '../../../common';
	import { onDestroy, onMount } from 'svelte';
	import { enigmatickWasm } from '../../../stores';

	export let note: Note | Article | Question;

	$: wasm = $enigmatickWasm;

	onMount(async () => {});

	class Placement {
		constructor(total: number) {
			Placement.total = total;
		}

		static total = 0;
		static iteration = 0;

		getPlacement(): string {
			Placement.iteration++;

			if (Placement.total % 2 === 0 || (Placement.total >= 3 && Placement.iteration !== 1)) {
				return 'half';
			} else {
				return 'full';
			}
		}
	}

	let placement: Placement = new Placement(note.attachment?.length || 0);

	let fullscreenImage: HTMLImageElement;
	let fullscreenMask: HTMLDivElement;
	let imageContainer: HTMLDivElement;

	const cancelSelect = (event: Event) => {
		//console.log(event);
		fullscreenImage.src = '#';
		imageContainer.classList.add('hidden');
		fullscreenMask.classList.add('hidden');
	};

	const selectImage = (event: Event) => {
		//console.log(event);

		if (event.target && (<HTMLImageElement>event.target).src) {
			fullscreenImage.src = (<HTMLImageElement>event.target).src;
			imageContainer.classList.remove('hidden');
			fullscreenMask.classList.remove('hidden');
		}
	};
</script>

<div class="mask hidden" bind:this={fullscreenMask} />
<div role="img" aria-labelledby="cancel" class="image hidden" bind:this={imageContainer}>
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-missing-attribute -->
	<img bind:this={fullscreenImage} src="#" on:click={cancelSelect} />
</div>

<section>
	{#if note.attachment}
		{#each note.attachment as x}
			{#if ((x.type == 'Document' && /^(?:image)\/.+$/.test(String(x.mediaType))) || x.type == 'Image')}
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div class={placement.getPlacement()} tabindex="0">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
					<img
						src={cachedContent(wasm, String(x.url))}
						width={x.width}
						height={x.height}
						alt={x.name}
						on:click={selectImage}
						on:error={(e) => console.log(e)}
					/>
				</div>
			{:else if (x.type == 'Document' && /^(?:video)\/.+$/.test(String(x.mediaType)) || x.type == 'Video')}
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div class={placement.getPlacement()} tabindex="0">
					<!-- svelte-ignore a11y-media-has-caption -->
					<video width={x.width || undefined} height={x.height || undefined} controls on:error={(e) => console.log(e)}
						><source
							src={cachedContent(wasm, String(x.url))}
							type={x.mediaType || undefined}
							on:error={(e) => console.log(e)}
						/></video
					>
				</div>
			{:else if x.type == 'Document' && /^(?:audio)\/.+$/.test(String(x.mediaType))}
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div class={placement.getPlacement()} tabindex="0">
					<!-- svelte-ignore a11y-media-has-caption -->
					<audio
						controls
						src={cachedContent(wasm, String(x.url))}
						on:error={(e) => console.log(e)}
					/>
				</div>
			{/if}
		{/each}
	{/if}
</section>

<style lang="scss">
	.mask {
		display: block;
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: #222;
		z-index: 31;
		opacity: 0.7;
	}

	div.image {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		height: 90vh;
		width: 90vw;
		z-index: 32;

		img {
			object-fit: contain;
			width: 100%;
			height: 100%;
			cursor: pointer;
		}
	}

	.hidden {
		visibility: hidden;
	}

	section {
		overflow: hidden;
		display: flex;
		flex-flow: row wrap;
		align-items: flex-start;
		justify-content: center;
		margin-top: 10px;

		:global(div) {
			display: flex;
			min-width: unset;
			min-height: unset;
			max-height: 50vh;
			height: 300px;
			box-sizing: border-box;
			width: 100%;
			text-align: center;
			margin: 0;
			padding: 2px;
			border-radius: 10px;
			overflow: hidden;
			cursor: pointer;
			align-items: center;

			:global(video),
			:global(img) {
				flex-shrink: 0;
				object-fit: cover;
				max-height: 50vh;
				height: 100%;
				width: 100%;
			}

			:global(audio) {
				height: auto;
				width: 100%;
			}
		}

		/* This works in Chrome, but not in Firefox yet. When it is more universal, we can
		shrink the "max-height" value of :global(div) a bit without worrying about cutting
		off video controls. */
		:global(div:has(> video)) {
			max-height: unset;

			:global(video) {
				width: 100%;
			}
		}

		:global(div.half) {
			width: 50%;
		}
	}
</style>
