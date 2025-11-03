<script lang="ts">
	import { page } from '$app/stores';
	import type {
		UserProfile,
		Note,
		Tag,
		Attachment,
		DisplayNote,
		AnnounceParams,
		Ephemeral
	} from '../../../common';
	import { onDestroy, onMount, getContext } from 'svelte';
	import {
		insertEmojis,
		timeSince,
		getWebFingerFromId,
		cachedContent,
		domainMatch
	} from '../../../common';

	let { 
		resetData, 
		hashtags,
		onHashtagRemove,
		onHashtagAdd
	}: { 
		resetData: Function; 
		hashtags: Set<string>;
		onHashtagRemove?: (tag: string) => void;
		onHashtagAdd?: (tag: string) => void;
	} = $props();
	let filterForm: HTMLFormElement;

	// Create reactive array from hashtags Set to ensure component re-renders when prop changes
	// Track the Set reference and size to ensure reactivity when the prop changes
	let hashtagsArray = $derived.by(() => {
		// Track the hashtags prop reference itself to detect when parent reassigns it
		const currentHashtags = hashtags;
		// Also track size to ensure reactivity
		const _ = currentHashtags.size;
		return Array.from(currentHashtags);
	});

	const handleSubmit = (event: SubmitEvent) => {
		event.preventDefault();

		const formData = new FormData(filterForm);

		let statement;
		if ((statement = formData.get('statement')?.toString().trim())) {
			statement = statement.startsWith('#') ? statement.slice(1) : statement;
			const tag = statement.toString().toLowerCase();

			// Use callback if provided, otherwise mutate directly
			if (onHashtagAdd) {
				onHashtagAdd(tag);
			} else {
				// Fallback: mutate directly (should work with $state in parent)
				hashtags.add(tag);
			}
			resetData();
		}

		filterForm.reset();
	};

	const handleRemove = (event: MouseEvent) => {
		event.preventDefault();
		// event.currentTarget is the element with the event handler (the <a> tag)
		// event.target might be a child element (like text node)
		let el = (event.currentTarget || event.target) as HTMLElement;
		let tag = el?.dataset['tag'];

		if (tag) {
			// Use callback if provided, otherwise mutate directly
			if (onHashtagRemove) {
				onHashtagRemove(tag);
			} else {
				// Fallback: mutate directly (should work with $state in parent)
				hashtags.delete(tag);
			}
			resetData();
		}
	};
</script>

<div class="filters">
	<div>
		{#each hashtagsArray as tag}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<a href="#filters" onclick={handleRemove} title="Delete" data-tag={tag}>#{tag}</a>
		{/each}
	</div>
	<form onsubmit={handleSubmit} bind:this={filterForm}>
		<input type="text" name="statement" placeholder="Filter Statement (e.g., #Enigmatick)" />
	</form>
</div>

<style lang="scss">
	div {
		width: 100%;
		background: #fafafa;
		padding: 5px 0;
		margin: 0;
		border: 0;

		div {
			display: flex;
			flex-direction: row;
			padding: 0;
			margin: 0 5px;
			width: calc(100% - 20px);
			border: 0;
			border-radius: 0;
			flex-wrap: wrap;
			background: #fafafa;

			a {
                font-family: "Open Sans";
				display: inline-block;
				padding: 5px;
				margin: 5px;
				background: goldenrod;
				color: #fff;
				border-radius: 5px;
                cursor: pointer;
				text-decoration: none;

				&:hover,
				&:visited,
				&:active {
					color: #fff;
				}
			}
		}

		form {
			width: 100%;

			input {
				width: calc(100% - 20px);
				padding: 10px;
				margin: 5px 10px;
				border-radius: 10px;
				border: 1px solid #ddd;
				background: #fff;
			}
		}
	}

	:global(body.dark) {
		div {
			background: #222;
			border-color: #333;

			div {
                background: inherit;
				a {
					background: maroon;
				}
			}

			form {
				input {
					background: #1a1a1a;
					color: white;
					border-color: #555;
				}
			}
		}
	}

	@media screen and (max-width: 1000px) {
		div {
			background: #eee;

			div {
				background: #eee;
			}
		}

		:global(body.dark) {
			div {
				background: #000;

				div {
					background: #000;
				}
			}
		}
	}
</style>
