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
			max-height: 300px;
			height: unset;
			width: 100%;
			text-align: center;
			padding: 0;
			overflow: hidden;
			cursor: pointer;

			:global(img) {
				height: unset;
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
			width: 100%;
		}
	}
</style>
