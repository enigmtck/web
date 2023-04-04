<script lang="ts">
	import type { UserProfile, Note, Tag, Attachment, DisplayNote } from '../../../common';
	import { insertEmojis, timeSince } from '../../../common';
	import { attachmentsDisplay } from './common';

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	import LinkPreview from './LinkPreview.svelte';

	export let note: DisplayNote;
	export let username: string | null;
	export let replyToHeader: string | null;
	export let announceHeader: string | null;
	export { attachmentsDisplay };

	function handleLike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		dispatch('like', {
			object,
			actor
		})

		event.target.classList.add('selected');
	}

	function handleUnlike(event: any) {}

	function handleNoteSelect(event: any) {
		dispatch('note_select', {
			note: event.target.dataset.note,
			conversation: event.target.dataset.conversation
		});
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
	{#if replyToHeader}
		{@html replyToHeader}
	{/if}
	{#if announceHeader}
		{@html announceHeader}
	{/if}

	<header>
		<div>
			{#if note.actor.icon}
				<img src={note.actor.icon.url} alt="Sender" />
			{/if}
		</div>
		<address>
			<span>{@html insertEmojis(note.actor.name || note.actor.preferredUsername, note.actor)}</span>
			<a href="/search?actor={note.actor.id}">{note.actor.url}</a>
		</address>
	</header>
	<section>{@html insertEmojis(note.note.content || '', note.note)}</section>
	{#if note.note.attachment && note.note.attachment.length > 0}
		<section class="attachments">{@html attachmentsDisplay(note.note)}</section>
	{/if}

	{#if note.note.ephemeralMetadata && note.note.ephemeralMetadata.length}
		<LinkPreview links={note.note.ephemeralMetadata} />
	{/if}

	{#if note.replies?.size}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<span
			class="comments"
			data-conversation={note.note.conversation}
			data-note={note.note.id}
			on:click|preventDefault={handleNoteSelect}
			><i class="fa-solid fa-comments" />
			{note.replies?.size}</span
		>
	{/if}
	<time datetime={note.published}>{timeSince(new Date(String(note.published)))}</time>
	{#if username}
		<nav>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<i
				class="fa-solid fa-expand"
				data-conversation={note.note.conversation}
				data-note={note.note.id}
				on:click|preventDefault={handleNoteSelect}
			/>

			<i class="fa-solid fa-repeat" />

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

<style lang="scss">
	article {
		display: flex;
		position: relative;
		flex-direction: column;
		width: 100%;
		margin: 0;
		border-bottom: 1px solid #ddd;
		font-family: 'Open Sans';
		background: #fafafa;
		overflow: hidden;

		:global(a) {
			color: darkgoldenrod;
		}

		:global(a:hover) {
			color: red;
		}

		:global(.reply),
		:global(.repost) {
			width: calc(100% - 130px);
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow: hidden;
			display: block;
			padding: 10px 10px 5px 10px;
			font-weight: 600;
			font-size: 14px;
			background: #fafafa;
			color: darkred;
		}

		:global(header) {
			padding: 10px 20px;
			color: #222;

			:global(address) {
				position: relative;
				width: calc(100% - 130px);
				padding: 0 15px;

				:global(span),
				:global(a) {
					display: block;
					overflow: hidden;
					white-space: nowrap;
					text-overflow: ellipsis;
				}
			}
		}

		:global(.comments) {
			display: inline-block;
			position: absolute;
			top: 10px;
			right: 50px;
			font-size: 14px;
			font-weight: 600;
			color: inherit;
			user-select: none;
			cursor: pointer;

			:global(i) {
				color: #555;
				pointer-events: none;
			}
		}

		:global(.comments:hover) {
			color: red;

			:global(i) {
				color: red;
			}
		}

		:global(time) {
			display: inline-block;
			position: absolute;
			top: 10px;
			right: 10px;
			font-style: normal;
			font-size: 14px;
			text-decoration: none;
			color: inherit;
			font-weight: 600;
		}

		:global(address > span),
		:global(address > a) {
			display: inline-block;
			font-style: normal;
			font-size: 12px;
			text-decoration: none;
		}

		:global(address > span) {
			display: inline-block;
			position: relative;
			width: 100%;
		}

		:global(address > a) {
			color: inherit;
			font-weight: 400;
		}

		:global(address > a:hover) {
			color: red;
		}

		:global(address > span:first-child) {
			font-size: 18px;
			color: #222;
		}

		:global(section) {
			padding: 0 20px;
			overflow-wrap: break-word;

			:global(pre) {
				white-space: pre;
			}
		}

		:global(section > p) {
			user-select: none;
			margin: 0 0 10px 0;

			:global(a) {
				display: inline-flex;

				:global(span.invisible) {
					display: none;
				}

				:global(span.ellipsis) {
					text-overflow: ellipsis;
					overflow: hidden;
					white-space: nowrap;
					max-width: 80%;
				}
			}
		}

		:global(.emoji) {
			display: inline;
			max-height: calc(1em - 2px);
			padding: 0;
			margin-bottom: 4px;
			width: auto;
			height: auto;
			vertical-align: middle;
		}

		:global(.attachments) {
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
			}

			:global(img),
			:global(video) {
				width: unset;
				height: unset;
				clip-path: unset;
				width: 100%;
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

		nav:hover {
			opacity: 1;
		}
	}

	article:hover {
		nav {
			transform: translateY(0);
		}
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
