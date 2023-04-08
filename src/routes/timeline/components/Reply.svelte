<script lang="ts">
	import type { UserProfile, Note, Tag, Attachment, DisplayNote } from '../../../common';
	import { insertEmojis, timeSince, compare, getWebFingerFromId } from '../../../common';
	import { attachmentsDisplay, replyCount } from './common';

	import { createEventDispatcher, onMount } from 'svelte';
	const dispatch = createEventDispatcher();

	export let note: DisplayNote;
	export let username: string | null;

	function forwardAnnounce(event: any) {
		dispatch('announce', event.detail);
	}

	function handleAnnounce(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		dispatch('announce', {
			object,
			actor
		});

		event.target.classList.add('selected');
	}

	function forwardLike(event: any) {
		dispatch('like', event.detail);
	}

	function handleLike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		dispatch('like', {
			object,
			actor
		});

		event.target.classList.add('selected');
	}

	function handleUnlike(event: any) {}

	function forwardNoteSelect(event: any) {
		dispatch('note_select', event.detail);
	}

	function handleNoteSelect(event: any) {
		dispatch('note_select', {
			note: event.target.dataset.note,
			conversation: event.target.dataset.conversation
		});
	}

	function forwardReplyTo(event: any) {
		dispatch('reply_to', event.detail);
	}

	function handleReplyTo(event: any) {
		dispatch('reply_to', {
			reply_to_recipient: event.target.dataset.recipient,
			reply_to_note: event.target.dataset.reply,
			reply_to_display: event.target.dataset.display,
			reply_to_conversation: event.target.dataset.conversation,

			reply_to_url: event.target.dataset.url,
			reply_to_username: event.target.dataset.username
		});
	}
</script>

<article>
	<div class="avatar">
		<div>
			{#if note.actor.icon}
				<img src={note.actor.icon.url} alt="Sender" />
			{/if}
		</div>
	</div>
	<address>
		<a href="/search?actor={note.actor.id}">
			{@html insertEmojis(note.actor.name || note.actor.preferredUsername, note.actor)} &bull;
			<span class="url">{getWebFingerFromId(note.actor)}</span>
		</a>
	</address>
	<section>{@html insertEmojis(note.note.content || '', note.note)}</section>
	{#if note.note.attachment && note.note.attachment.length > 0}
		<section class="attachments">{@html attachmentsDisplay(note.note)}</section>
	{/if}

	{#if note.replies?.size}
		<span class="comments" data-conversation={note.note.conversation} data-note={note.note.id}
			><i class="fa-solid fa-comments" />
			{replyCount(note)}</span
		>
	{/if}
	<time datetime={note.published}>{timeSince(new Date(String(note.published)))}</time>
	{#if username}
		<nav>
			{#if note.note.ephemeralAnnounced}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-repeat selected"
					data-object={note.note.id}
					data-actor={note.note.attributedTo}
					on:click|preventDefault={handleAnnounce}
				/>
			{:else}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-repeat"
					data-object={note.note.id}
					data-actor={note.note.attributedTo}
					on:click|preventDefault={handleAnnounce}
				/>
			{/if}

			{#if note.note.ephemeralLiked}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-star selected"
					data-actor={note.note.attributedTo}
					data-object={note.note.id}
					on:click|preventDefault={handleUnlike}
				/>
			{:else}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-star"
					data-actor={note.note.attributedTo}
					data-object={note.note.id}
					on:click|preventDefault={handleLike}
				/>
			{/if}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<i
				class="fa-solid fa-reply"
				data-reply={note.note.id}
				data-display={note.actor.name || note.actor.preferredUsername}
				data-url={note.actor.url}
				data-username={note.actor.name}
				data-recipient={note.actor.id}
				data-conversation={note.note.conversation}
				on:click={handleReplyTo}
			/>
		</nav>
	{/if}
</article>

{#if note.replies?.size}
	<div class="replies">
		{#each Array.from(note.replies.values()).sort(compare) as reply}
			<svelte:self
				note={reply}
				{username}
				on:reply_to={forwardReplyTo}
				on:note_select={forwardNoteSelect}
				on:like={forwardLike}
				on:announce={forwardAnnounce}
			/>
		{/each}
	</div>
{/if}

<style lang="scss">
	article {
		position: relative;
		width: 100%;
		margin: 0;
		border-bottom: 1px solid #ddd;
		font-family: 'Open Sans';
		background: #fafafa;
		overflow: hidden;
		display: grid;
		grid-template-columns: 90px 1fr;
		grid-auto-rows: minmax(10px, auto);
		grid-template-areas:
			'avatar address'
			'avatar content'
			'avatar attachments';

		:global(.emoji) {
			display: inline;
			max-height: calc(1em - 2px);
			padding: 0;
			margin-bottom: 4px;
			width: auto;
			height: auto;
			vertical-align: middle;
		}

		:global(img),
		:global(video) {
			width: unset;
			height: unset;
			clip-path: unset;
			width: 100%;
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

		section {
			grid-area: content;
			padding: 0;

			:global(p) {
				width: 100%;
				margin: 5px 0;
				padding: 0 5px 0 0;
				font-size: 14px;
			}
		}

		time {
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

		.attachments {
			grid-area: attachments;
			padding: 0 5px 0 0;

			:global(img) {
				clip-path: unset;
			}
		}

		nav {
			width: 100%;
			position: absolute;
			z-index: unset;
			top: unset;
			right: unset;
			bottom: 0;
			left: 0;
			background: #eee;
			padding: 5px 0;
			margin: 0;
			opacity: 0.3;
			transform: translateY(100%);
			transition-duration: 300ms;

			i {
				text-align: center;
				font-size: 14px;
				color: #444;
				width: calc(95% / 3);
			}

			i:hover {
				cursor: pointer;
				color: red;
			}

			i.selected {
				color: goldenrod;
			}
		}

		nav:hover {
			opacity: 1;
		}
	}

	article:hover {
		nav {
			transform: translateY(0);
		}
	}

	.replies {
		margin-left: 1px;
		border-left: 2px solid darkred;
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
				background: #555;

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
