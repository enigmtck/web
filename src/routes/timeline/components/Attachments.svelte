<script lang="ts">
	import type { Note } from '../../../common';
	export let note: Note;

	function getPlacement(): string {
		if (total > 1) {
			return 'half';
		} else {
			return 'full';
		}
	}

	let total = note.attachment?.length || 0;

	let remaining = note.attachment?.length || 0;
</script>

<section>
	{#if note.attachment}
		{#each note.attachment as x}
			{#if x.type == 'Document' && /^(?:image)\/.+$/.test(String(x.mediaType))}
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div class={getPlacement()} tabindex="0">
					<img src={x.url} width={x.width} height={x.height} alt={x.name} />
				</div>
			{:else if x.type == 'Document' && /^(?:video)\/.+$/.test(String(x.mediaType))}
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div class={getPlacement()} tabindex="0">
					<!-- svelte-ignore a11y-media-has-caption -->
					<video width={x.width} height={x.height} controls
						><source src={x.url} type={x.mediaType} /></video
					>
				</div>
			{/if}
		{/each}
	{/if}
</section>

<style lang="scss">
	section {
		overflow: hidden;
		padding-bottom: 10px;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;

		:global(div) {
			min-width: unset;
			min-height: unset;
			width: unset;
			height: unset;
			text-align: center;
			padding: 0;
			width: 100%;
			overflow: hidden;
			max-height: 200px;
			cursor: pointer;

			:global(img),
			:global(video) {
				height: unset;
				width: 100%;
			}
		}

		:global(div.half) {
			width: 50%;
		}

		:global(div:focus) {
			max-height: unset;
			width: unset;
			z-index: 40;
		}
	}
</style>
