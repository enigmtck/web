<script lang="ts">
	import type { DisplayNote, Ephemeral, UserProfileTerse } from '../../../common';
	import {
		insertEmojis,
		compare,
		getWebFingerFromId,
		cachedContent,
		decrypt,
		getFirstValue
	} from '../../../common';
	import { type ComposeDispatch, replyCount } from './common';
	import { enigmatickWasm } from '../../../stores';
	import Attachments from './Attachments.svelte';

	import { createEventDispatcher, onMount } from 'svelte';
	import TimeAgo from './TimeAgo.svelte';
	import Menu from './Menu.svelte';
	const replyToDispatch = createEventDispatcher<{ replyTo: ComposeDispatch }>();

	$: wasm = $enigmatickWasm;
	export let note: DisplayNote;
	export let username: string | null;
	export let remove: (note: string) => void;
	export let parentArticle: any = null;

	let content: string;
	$: {
		content = (note.note.type == 'Note' ? note.note.content : decrypt(wasm, note.activity)) || '';
	}

	function handleAnnounce(displayNote: DisplayNote) {
		//console.debug('Handling Announce');

		if (displayNote.note.id) {
			const object: string = displayNote.note.id;

			if (object) {
				wasm?.send_announce(object).then((id) => {
					//console.debug('Announce sent');
					let ephemeral: Ephemeral = displayNote.note.ephemeral || {};
					ephemeral.announced = id;
					displayNote.note.ephemeral = ephemeral;
					note = displayNote;
				});
			} else {
				console.error(`Object invalid: ${object}`);
			}
		}
	}

	function handleLike(displayNote: DisplayNote) {
		//console.debug('Handling Like');

		if (displayNote.note.id && displayNote.note.attributedTo) {
			const to: string | null = getFirstValue(displayNote.note.attributedTo);
			const object: string = displayNote.note.id;

			if (to) {
				wasm?.send_like(to, object).then((id) => {
					//console.debug('Like sent');
					let ephemeral: Ephemeral = displayNote.note.ephemeral || {};
					ephemeral.liked = id;
					displayNote.note.ephemeral = ephemeral;
					note = displayNote;
				});
			}
		}
	}

	function handleUnlike(displayNote: DisplayNote) {
		//console.debug('Handling Unike');

		if (displayNote.note.id && displayNote.note.attributedTo) {
			const actor: string | null = getFirstValue(displayNote.note.attributedTo);
			const object: string = displayNote.note.id;

			if (actor && displayNote.note.ephemeral && displayNote.note.ephemeral.liked) {
				wasm?.send_unlike(actor, object, displayNote.note.ephemeral.liked).then((uuid) => {
					//console.debug('Unlike sent');
					let ephemeral: Ephemeral = displayNote.note.ephemeral || {};
					ephemeral.liked = null;
					displayNote.note.ephemeral = ephemeral;
					note = displayNote;
				});
			}
		}
	}

	function handleReplyTo(displayNote: DisplayNote) {
		replyToDispatch('replyTo', {
			replyToNote: displayNote,
			replyToActor: displayNote.actor,
			openAside: true
		});
	}

	const findMatchingProfile = (profiles: UserProfileTerse[], noteAttributedTo: string | string[] | null | undefined): UserProfileTerse => {
		// If noteAttributedTo is null, undefined, or an array, fall back to first profile
		if (!noteAttributedTo || Array.isArray(noteAttributedTo)) {
			return profiles[0];
		}
		
		// First try to find an exact match by ID
		const exactMatch = profiles.find(profile => profile.id === noteAttributedTo);
		if (exactMatch) {
			return exactMatch;
		}
		
		// If no exact match, fall back to the first profile
		return profiles[0];
	};

	let profiles = note.note.ephemeral?.attributedTo ?? [note.actor];
	let actorTerseProfile = findMatchingProfile(profiles, note.note.attributedTo);
	let actorIcon = actorTerseProfile.icon?.url;
	let actorName = actorTerseProfile.name ?? actorTerseProfile.preferredUsername;
</script>

<div class="container">
	<article>
		<div class="avatar">
			<div>
				{#if actorIcon}
					<img src={cachedContent(wasm, actorIcon)} alt="Sender" />
				{/if}
			</div>
		</div>
		<address>
			{#if actorName}
				<a href="/{getWebFingerFromId(note.actor)}">
					{@html insertEmojis(wasm, actorName, actorTerseProfile)} &bull;
					<span class="url">{getWebFingerFromId(actorTerseProfile)}</span>
				</a>
			{/if}
		</address>
		<section>{@html insertEmojis(wasm, content || '', note.note)}</section>

		{#if note.note.attachment && note.note.attachment.length > 0}
			<Attachments note={note.note} />
		{/if}

		{#if note.replies?.size}
			<span class="comments" data-conversation={note.note.conversation} data-note={note.note.id}
				><i class="fa-solid fa-comments" />
				{replyCount(note)}</span
			>
		{/if}

		<TimeAgo timestamp={new Date(note.published)} />

		{#if username}
			<nav>
				{#if note.note.ephemeral?.announced}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i
						class="fa-solid fa-repeat selected"
						on:click|preventDefault={() => handleAnnounce(note)}
					/>
				{:else}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-repeat" on:click|preventDefault={() => handleAnnounce(note)} />
				{/if}

				{#if note.note.ephemeral?.liked}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-star selected" on:click|preventDefault={() => handleUnlike(note)} />
				{:else}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-star" on:click|preventDefault={() => handleLike(note)} />
				{/if}

				{#if note.actor}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-reply" on:click={() => handleReplyTo(note)} />
				{/if}

				{#if note.note.id}
					{#await wasm?.get_ap_id() then ap_id}
						<Menu
							{remove}
							reload = {() => {}}
							object={note.note.id}
							owner={ap_id == note.note.attributedTo}
						/>
					{/await}
				{/if}
			</nav>
		{/if}
	</article>

	{#if note.replies?.size}
		<div class="replies">
			{#each Array.from(note.replies.values()).sort(compare).reverse() as reply}
				<svelte:self note={reply} {username} {remove} on:replyTo parentArticle={parentArticle} />
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	div.container {
		width: 100%;
		max-width: 680px;
	}
	article {
		position: relative;
		margin: 0;
		border-bottom: 1px solid #ddd;
		font-family: 'Open Sans';
		background: #fafafa;
		display: grid;
		grid-template-columns: 90px auto;
		grid-auto-rows: minmax(10px, auto);
		grid-template-areas:
			'avatar address'
			'avatar content'
			'avatar attachments'
			'avatar nav';

		:global(.emoji) {
			display: inline;
			max-height: calc(1em - 2px);
			padding: 0;
			margin-bottom: 4px;
			width: auto;
			height: auto;
			vertical-align: middle;
		}

		.comments {
			display: inline-block;
			position: absolute;
			top: 10px;
			right: 50px;
			font-size: 14px;
			font-weight: 600;
			color: inherit;
			user-select: none;

			:global(i) {
				color: #555;
				pointer-events: none;
			}
		}

		.avatar {
			grid-area: avatar;
			padding: 10px 15px 10px 20px;

			img {
				width: 55px;
				clip-path: inset(0 0 0 0 round 20%);
			}
		}

		address {
			grid-area: address;
			padding-top: 10px;
			width: calc(100% - 100px);
			overflow: hidden;
			text-overflow: ellipsis;

			span:first-child,
			a {
				display: block;
				font-size: 13px;
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
				font-style: normal;
				font-weight: 600;
				color: #222;
			}

			span.url {
				color: #555;
				display: inline;
			}

			span.url:hover {
				color: red;
			}
		}

		section, section pre, section code {
			min-width: 0;
			max-width: 100%;
			box-sizing: border-box;
			word-break: break-word;
			padding-right: 10px;
			font-size: 14px;
		}
		section pre {
			overflow-x: auto;
			white-space: pre-wrap;
		}
		section code {
			white-space: pre-wrap;
		}

		:global(time) {
			font-size: 13px;
			display: inline-block;
			position: absolute;
			top: 10px;
			right: 10px;
			font-style: normal;
			text-decoration: none;
			color: inherit;
			font-weight: 600;
		}

		nav {
			grid-area: nav;
			width: 100%;
			z-index: 25;
			padding: 5px 0;
			margin: 0;
			opacity: 0;
			max-height: 0;
			overflow: hidden;
			transition: opacity 0.5s ease-in-out, max-height 0.5s ease-in-out;

			i {
				text-align: center;
				font-size: 14px;
				color: #444;
				width: calc(95% / 4);
			}

			i:hover {
				cursor: pointer;
				color: red;
			}

			i.selected {
				color: goldenrod;
			}
		}
	}

	article:hover {
		nav {
			opacity: 1;
			max-height: 50px;
		}
	}

	.replies {
		width: calc(100% - 1px);
		margin-left: 1px;
		border-left: 2px solid darkred;
		box-sizing: border-box;
	}

	:global(body.dark) {
		:global(a) {
			color: darkgoldenrod;
		}

		:global(a:hover) {
			color: red;
		}

		article {
			background: #000;
			color: #fff;
			border-bottom: 1px solid #222;

			:global(> code),
			:global(p > code) {
				background: #222;
			}

			:global(.reply),
			:global(.repost) {
				background: #000;
				color: #aaa;
			}

			:global(header) {
				color: #aaa;
			}

			:global(address > span:first-child) {
				font-size: 18px;
				color: #eee;
			}

			nav {
				i {
					color: #fff;
				}

				i:hover {
					color: red;
				}

				i.selected {
					color: goldenrod;
				}
			}
		}

		.replies {
			background: #000;

			article {
				address {
					a {
						color: #ddd;
					}
				}
			}
		}

		nav {
			background: #000;

			i {
				color: #ccc;
			}
		}
	}
</style>
