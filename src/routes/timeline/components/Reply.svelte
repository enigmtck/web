<script lang="ts">
	import { onDestroy, setContext, getContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import type { UserProfile, Note, Tag, Attachment, DisplayNote } from '../../../common';
	import { insertEmojis, timeSince, compare, getWebFingerFromId } from '../../../common';
	import { replyCount } from './common';
	import { enigmatickWasm } from '../../../stores';
	import Attachments from './Attachments.svelte';

	import { createEventDispatcher, onMount } from 'svelte';
	const dispatch = createEventDispatcher();

	//export let wasm: typeof import('enigmatick_wasm');
	$: wasm = $enigmatickWasm;
	export let note: DisplayNote;
	export let username: string | null;

	function forwardAnnounce(event: any) {
		dispatch('announce', event.detail);
	}

	function handleAnnounce(event: any) {
		console.debug('HANDLING DISPATCHED ANNOUNCE');
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		if (wasm && object && actor) {
			// wasm.send_announce(actor, object).then(() => {
			// 	// this will only work for top-level notes
			// 	//let note = notes.get(object);
			// 	//if (note) {
			// 		//note.note.ephemeralAnnounced = true;
			// 	//}
			// });

			event.target.classList.add('selected');
		} else {
			console.error('OBJECT OR ACTOR INVALID');
			console.debug(`OBJECT: ${object}, ACTOR: ${actor}`);
		}
	}

	function handleLike(event: any) {
		console.debug('HANDLING DISPATCHED LIKE');
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		if (wasm) {
			wasm.send_like(actor, object).then(() => {
				// this will only work for top-level notes
				/* let note = notes.get(object);
			if (note) {
				note.note.ephemeralLiked = true;
			} */
			});
		}
	}

	function handleUnlike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);
	}

	function forwardNoteSelect(event: any) {
		dispatch('noteSelect', event.detail);
	}

	function handleNoteSelect(event: any) {
		dispatch('noteSelect', {
			note: event.target.dataset.note,
			conversation: event.target.dataset.conversation
		});
	}

	function forwardReplyTo(event: any) {
		dispatch('replyTo', event.detail);
	}

	function handleReplyTo(event: any) {
		console.log("IN handleReplyTo");

		dispatch('replyTo', {
			replyToRecipient: event.target.dataset.recipient,
			replyToNote: event.target.dataset.reply,
			replyToDisplay: event.target.dataset.display,
			replyToConversation: event.target.dataset.conversation,

			replyToUrl: event.target.dataset.url,
			replyToUsername: event.target.dataset.username,
			openAside: true
		});
	}
</script>

<div class="container">
	<article>
		<div class="avatar">
			<div>
				{#if note.actor && note.actor.icon}
					<img src={note.actor.icon.url} alt="Sender" />
				{/if}
			</div>
		</div>
		<address>
			{#if note.actor}
				<a href="/search?actor={note.actor.id}">
					{@html insertEmojis(wasm, note.actor.name || note.actor.preferredUsername, note.actor)} &bull;
					<span class="url">{getWebFingerFromId(note.actor)}</span>
				</a>
			{/if}
		</address>
		<section>{@html insertEmojis(wasm, note.note.content || '', note.note)}</section>

		{#if note.note.attachment && note.note.attachment.length > 0}
			<Attachments note={note.note} />
		{/if}

		{#if note.replies?.size}
			<span class="comments" data-conversation={note.note.conversation} data-note={note.note.id}
				><i class="fa-solid fa-comments" />
				{replyCount(note)}</span
			>
		{/if}
		<time datetime={note.published}>{timeSince(new Date(String(note.published)).getTime())}</time>
		{#if username}
			<nav>
				{#if note.note.ephemeralAnnounced}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i
						class="fa-solid fa-repeat selected"
						data-object={note.note.id}
						data-actor={note.note.attributedTo}
						on:click|preventDefault={handleAnnounce}
					/>
				{:else}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i
						class="fa-solid fa-repeat"
						data-object={note.note.id}
						data-actor={note.note.attributedTo}
						on:click|preventDefault={handleAnnounce}
					/>
				{/if}

				{#if note.note.ephemeralLiked}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i
						class="fa-solid fa-star selected"
						data-actor={note.note.attributedTo}
						data-object={note.note.id}
						on:click|preventDefault={handleUnlike}
					/>
				{:else}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i
						class="fa-solid fa-star"
						data-actor={note.note.attributedTo}
						data-object={note.note.id}
						on:click|preventDefault={handleLike}
					/>
				{/if}

				{#if note.actor}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i
						class="fa-solid fa-reply"
						data-reply={note.note.id}
						data-display={note.actor.name || note.actor.preferredUsername}
						data-url={note.actor.url}
						data-username={note.actor.preferredUsername}
						data-recipient={note.actor.id}
						data-conversation={note.note.conversation}
						on:click|preventDefault={handleReplyTo}
					/>
				{/if}
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
				/>
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

		nav {
			width: 100%;
			position: absolute;
			z-index: 36;
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
