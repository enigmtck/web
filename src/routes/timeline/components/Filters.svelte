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

	export let resetData: Function;
	export let hashtags: Set<string>;
	let filterForm: HTMLFormElement;

	const handleSubmit = (event: SubmitEvent) => {
		event.preventDefault();

		const formData = new FormData(filterForm);

		let statement;
		if ((statement = formData.get('statement')?.toString().trim())) {
			statement = statement.startsWith('#') ? statement.slice(1) : statement;

			hashtags.add(statement.toString().toLowerCase());
			hashtags = hashtags;
			resetData();
		}

		filterForm.reset();
	};

	const handleRemove = (event: MouseEvent) => {
		event.preventDefault();
		let el = event.target as HTMLElement;
		let tag = el.dataset['tag'];

		if (tag) {
			hashtags.delete(tag);
            hashtags = hashtags;
			resetData();
		}
	};
</script>

<div class="filters">
	<div>
		{#each hashtags as tag}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<a href="#filters" on:click={handleRemove} title="Delete" data-tag={tag}>#{tag}</a>
		{/each}
	</div>
	<form on:submit={handleSubmit} bind:this={filterForm}>
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
				font-size: 12px;
                cursor: pointer;
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
			background: #000;
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
</style>
