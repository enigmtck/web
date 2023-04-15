<script lang="ts">
	import type {
		UserProfile,
		Note,
		Tag,
		Attachment,
		DisplayNote,
		AnnounceParams
	} from '../../../common';
	import { onDestroy, onMount, getContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import { insertEmojis, timeSince, getWebFingerFromId } from '../../../common';
	import { replyCount } from './common';
	import { enigmatickWasm } from '../../../stores';

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	import LinkPreview from './LinkPreview.svelte';
	import Menu from './Menu.svelte';
	import Attachments from './Attachments.svelte';

	$: wasm = $enigmatickWasm;

	export let note: DisplayNote;
	export let username: string | null;
	export let replyToHeader: string | null;
	export let announceHeader: AnnounceParams | null;

	function handleUnlike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);
	}

	function handleLike(event: any) {
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

		event.target.classList.add('selected');
	}

	function handleAnnounce(event: any) {
		console.debug('HANDLING DISPATCHED ANNOUNCE');
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		if (wasm && object && actor) {
			wasm.send_announce(actor, object).then(() => {
				// this will only work for top-level notes
				//let note = notes.get(object);
				//if (note) {
				//note.note.ephemeralAnnounced = true;
				//}
			});

			event.target.classList.add('selected');
		} else {
			console.error('OBJECT OR ACTOR INVALID');
			console.debug(`OBJECT: ${object}, ACTOR: ${actor}`);
		}
	}

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
		<span class="reply">
			<i class="fa-solid fa-reply" /> In reply to {replyToHeader}
		</span>
	{/if}
	{#if announceHeader}
		<span class="repost">
			<i class="fa-solid fa-retweet" /> Reposted by
			<a href={announceHeader.url}>{@html announceHeader.name}</a>{announceHeader.others}
		</span>
	{/if}

	<header>
		<div>
			{#if note.actor && note.actor.icon}
				<img src={note.actor.icon.url} alt="Sender" />
			{/if}
		</div>
		<address>
			{#if note.actor}
				<span
					>{@html insertEmojis(note.actor.name || note.actor.preferredUsername, note.actor)}</span
				>
				<a href="/search?actor={note.actor.id}">
					{getWebFingerFromId(note.actor)}
				</a>
			{/if}
		</address>
	</header>
	<section>{@html insertEmojis(note.note.content || '', note.note)}</section>
	{#if note.note.attachment && note.note.attachment.length > 0}
		<Attachments note={note.note} />
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
			{replyCount(note)}</span
		>
	{/if}
	<time datetime={note.published}
		><a href={note.note.id} target="_blank" rel="noreferrer"
			>{timeSince(new Date(String(note.published)).getTime())}</a
		></time
	>
	{#if username}
		<nav>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<i
				class="fa-solid fa-expand"
				data-conversation={note.note.conversation}
				data-note={note.note.id}
				on:click|preventDefault={handleNoteSelect}
			/>

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

			{#if note.actor}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i
					class="fa-solid fa-reply"
					data-reply={note.note.id}
					data-display={note.actor.name || note.actor.preferredUsername}
					data-url={note.actor.url}
					data-username={note.actor.preferredUsername}
					data-recipient={note.actor.id}
					data-conversation={note.note.conversation}
					on:click={handleReplyTo}
				/>
			{/if}

			{#if note.note.id}
				{#await wasm?.get_ap_id() then ap_id}
					<Menu object={note.note.id} owner={ap_id == note.note.attributedTo} />
				{/await}
			{/if}
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

		a {
			color: darkgoldenrod;
		}

		a:hover {
			color: red;
		}

		.reply,
		.repost {
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

		header {
			padding: 10px 20px;
			color: #222;

			display: flex;
			flex-direction: row;
			width: 100%;

			div {
				display: inline-block;
				width: calc(100% - 55px);
			}

			div:first-child {
				width: 55px;
			}

			img {
				width: 100%;
				clip-path: inset(0 0 0 0 round 20%);
			}

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

		.comments {
			display: inline-block;
			position: absolute;
			top: 10px;
			right: 50px;
			font-size: 14px;
			font-weight: 600;
			color: inherit;
			user-select: none;
			cursor: pointer;

			i {
				color: #555;
				pointer-events: none;
			}
		}

		.comments:hover {
			color: red;

			:global(i) {
				color: red;
			}
		}

		time {
			display: inline-block;
			position: absolute;
			top: 10px;
			right: 10px;
			font-style: normal;
			font-size: 14px;
			text-decoration: none;
			color: inherit;
			font-weight: 600;

			a {
				color: inherit;
			}
		}

		:global(address > span),
		address > a {
			display: inline-block;
			font-style: normal;
			font-size: 12px;
			text-decoration: none;
		}

		:global(address > span) {
			position: relative;
			width: 100%;
		}

		address > a {
			color: inherit;
			font-weight: 400;
		}

		address > a:hover {
			color: red;
		}

		:global(address > span:first-child) {
			font-size: 18px;
			color: #222;
		}

		section {
			padding: 0 20px;
			overflow-wrap: break-word;
			font-size: 14px;

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

		nav {
			width: 100%;
			position: relative;
			z-index: unset;
			background: #eee;
			padding: 10px 0;
			margin: 0;
			opacity: 0.3;
			display: flex;
			flex-direction: row;
			transition-duration: 300ms;

			i {
				text-align: center;
				font-size: 14px;
				color: #444;
				width: calc(100% / 5);
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

	:global(body.dark) {
		a {
			color: darkgoldenrod;
		}

		a:hover {
			color: red;
		}

		article {
			background: #000;
			color: #fff;
			border-bottom: 1px solid #222;

			time {
				a {
					color: inherit;
				}
			}

			:global(> code),
			:global(p > code) {
				background: #222;
			}

			.reply,
			.repost {
				background: #000;
				color: #aaa;
			}

			header {
				color: #aaa;
			}

			:global(address > span:first-child) {
				font-size: 18px;
				color: #eee;
			}

			nav {
				background: unset;

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
