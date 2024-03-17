<script lang="ts">
	import type { Note } from '../../../common';
	import { cachedImage } from '../../../common';
	import { onDestroy, onMount } from 'svelte';
	import { enigmatickWasm } from '../../../stores';

	export let note: Note;

	$: wasm = $enigmatickWasm;

	onMount(async () => {
		const { Buffer } = await import('buffer');
		window.Buffer = Buffer;
	});

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

	let remaining = note.attachment?.length || 0;
</script>

<section>
	{#if note.attachment}
		{#each note.attachment as x}
			{#if x.type == 'Document' && /^(?:image)\/.+$/.test(String(x.mediaType))}
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div class={placement.getPlacement()} tabindex="0">
					<img
						src={cachedImage(wasm, window.Buffer, String(x.url))}
						width={x.width}
						height={x.height}
						alt={x.name}
					/>
				</div>
			{:else if x.type == 'Document' && /^(?:video)\/.+$/.test(String(x.mediaType))}
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div class={placement.getPlacement()} tabindex="0">
					<!-- svelte-ignore a11y-media-has-caption -->
					<video width={x.width} height={x.height} controls
						><source
							src={cachedImage(wasm, window.Buffer, String(x.url))}
							type={x.mediaType}
						/></video
					>
				</div>
			{/if}
		{/each}
	{/if}
</section>

<style lang="scss">
	section {
		overflow: hidden;
		display: flex;
		flex-flow: row wrap;
		align-items: flex-start;
		justify-content: center;
		border-radius: 20px;
		border: 1px solid #444;
		margin-top: 10px;

		:global(div) {
			display: flex;
			min-width: unset;
			min-height: unset;
			max-height: 400px;
			height: unset;
			width: 100%;
			text-align: center;
			margin: unset;
			padding: 0;
			overflow: hidden;
			cursor: pointer;

			:global(video),
			:global(img) {
				flex-shrink: 0;
				object-fit: cover;
				max-height: 50vh;
				height: 100%;
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

		:global(div:focus) {
			max-height: unset;
			object-fit: contain;
			width: 100%;
		}
	}
</style>
