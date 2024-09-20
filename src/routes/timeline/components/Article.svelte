<script lang="ts">
	import { page } from '$app/stores';
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
	import {
		insertEmojis,
		timeSince,
		getWebFingerFromId,
		cachedContent,
		domainMatch
	} from '../../../common';
	import { replyCount, ComposeDispatch } from './common';
	import { enigmatickWasm } from '../../../stores';

	import { createEventDispatcher } from 'svelte';
	const replyToDispatch = createEventDispatcher<{ replyTo: ComposeDispatch }>();
	const noteSelectDispatch = createEventDispatcher<{ noteSelect: ComposeDispatch }>();

	import LinkPreview from './LinkPreview.svelte';
	import Menu from './Menu.svelte';
	import Attachments from './Attachments.svelte';

	onMount(async () => {
		if (wasm && note && note.note && note.note.id) {
			article_id = wasm.get_url_safe_base64(note.note.id);
		}
	});

	$: wasm = $enigmatickWasm;

	export let note: DisplayNote;
	export let username: string | null;
	export let replyToHeader: string | null;
	export let announceHeader: AnnounceParams | null;
	export let renderAction: (node: any) => void;
	export let refresh: () => void;
	export let remove: (note: string) => void;

	function handleUnlike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);
		const activity: string = String(event.target.dataset.activity);

		console.debug(`UNDOING ${activity}`);

		if (wasm) {
			wasm.send_unlike(actor, object, activity).then((uuid) => {
				console.debug('UNLIKE SENT');
				note.note.ephemeralLiked = null;
				note = note;
			});
		}
	}

	function handleLike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		if (wasm) {
			wasm.send_like(actor, object).then((uuid) => {
				console.debug(`LIKE SENT ${uuid}`);
				note.note.ephemeralLiked = uuid;
				note = note;
			});
		}
	}

	function handleUnannounce(event: any) {
		const object: string = String(event.target.dataset.object);
		const activity: string = String(event.target.dataset.activity);

		if (wasm && object) {
			wasm.send_unannounce(object, activity).then((uuid) => {
				console.debug('UNANNOUNCE SENT');
				note.note.ephemeralAnnounced = null;
				note = note;
			});
		} else {
			console.error('OBJECT INVALID');
		}
	}

	function handleAnnounce(event: any) {
		const object: string = String(event.target.dataset.object);

		if (wasm && object) {
			wasm.send_announce(object).then((uuid) => {
				console.debug(`ANNOUNCE SENT ${uuid}`);
				note.note.ephemeralAnnounced = uuid;
				note = note;
			});
		} else {
			console.error('OBJECT INVALID');
		}
	}

	function handleNoteSelect(event: any) {
		console.log('DISPATCHING NOTE_SELECT');
		console.log(event);

		noteSelectDispatch('noteSelect', {
			replyToConversation: event.target.dataset.conversation,

			replyToRecipient: event.target.dataset.recipient,
			replyToNote: event.target.dataset.note,
			replyToDisplay: insertEmojis(wasm, event.target.dataset.display, note.actor),

			replyToUrl: event.target.dataset.url,
			replyToUsername: event.target.dataset.username,
			openAside: false
		});
	}

	function handleReplyTo(event: any) {
		replyToDispatch('replyTo', {
			replyToRecipient: event.target.dataset.recipient,
			replyToNote: event.target.dataset.reply,
			replyToDisplay: insertEmojis(wasm, event.target.dataset.display, note.actor),
			replyToConversation: event.target.dataset.conversation,

			replyToUrl: event.target.dataset.url,
			replyToUsername: event.target.dataset.username,
			openAside: true
		});
	}

	let target: string | null = null;
	let rel: string | null = null;

	if (note && note.note && note.note.url && !domainMatch($page.url.toString(), note.note.url)) {
		target = '_blank';
		rel = 'noreferrer';
	}

	let article_id = '';
</script>

<article use:renderAction data-conversation={note.note.conversation} id={article_id}>
	{#if replyToHeader}
		<span class="reply">
			<i class="fa-solid fa-reply" /> In
			<a href={note.note.inReplyTo} target="_blank" rel="noreferrer">reply</a>
			to {@html replyToHeader}
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
				<img src={cachedContent(wasm, window.Buffer, note.actor.icon.url)} alt="Sender" />
			{/if}
		</div>
		<address>
			{#if note.actor}
				<span
					>{@html insertEmojis(
						wasm,
						note.actor.name || note.actor.preferredUsername,
						note.actor
					)}</span
				>
				<a href="/{getWebFingerFromId(note.actor)}">
					{getWebFingerFromId(note.actor)}
				</a>
			{/if}
		</address>
	</header>
	<section>{@html insertEmojis(wasm, note.note.content || '', note.note)}</section>

	{#if note.note.attachment && note.note.attachment.length > 0}
		<Attachments note={note.note} />
	{:else if note.note.ephemeralMetadata && note.note.ephemeralMetadata.length}
		<LinkPreview links={note.note.ephemeralMetadata} />
	{/if}

	<div class="activity">
		{#if note.note.ephemeralLikes?.length}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<span class="likes"
				><i class="fa-solid fa-star" />
				{note.note.ephemeralLikes.length}</span
			>
		{/if}
		{#if note.replies?.size}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<span
				class="comments"
				data-display={note.actor.name || note.actor.preferredUsername}
				data-url={note.actor.url}
				data-username={note.actor.preferredUsername}
				data-recipient={note.actor.id}
				data-conversation={note.note.conversation}
				data-note={note.note.id}
				on:click|preventDefault={handleNoteSelect}
				><i class="fa-solid fa-comments" />
				{replyCount(note)}</span
			>
		{/if}
	</div>
	<time datetime={note.published}>
		<a href={note.note.url} {target} {rel}
			>{timeSince(new Date(String(note.published)).getTime())}</a
		>
	</time>
	{#if username}
		<nav>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<i
				class="fa-solid fa-expand"
				data-conversation={note.note.conversation}
				data-note={note.note.id}
				data-reply={note.note.id}
				data-display={note.actor.name || note.actor.preferredUsername}
				data-url={note.actor.url}
				data-username={note.actor.preferredUsername}
				data-recipient={note.actor.id}
				on:click|preventDefault={handleNoteSelect}
			/>

			{#if note.note.ephemeralAnnounced}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<i
					class="fa-solid fa-repeat selected"
					data-object={note.note.id}
					data-activity={note.note.ephemeralAnnounced}
					on:click|preventDefault={handleUnannounce}
				/>
			{:else}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<i
					class="fa-solid fa-repeat"
					data-object={note.note.id}
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
					data-activity={note.note.ephemeralLiked}
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
					on:click={handleReplyTo}
				/>
			{/if}

			{#if note.note.id}
				{#await wasm?.get_ap_id() then ap_id}
					<Menu {remove} {refresh} object={note.note.id} owner={ap_id == note.note.attributedTo} />
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
		max-width: 700px;
		margin: 10px auto;
		border-bottom: 1px solid #ddd;
		border-radius: 10px;
		padding: 10px 20px;
		font-family: 'Open Sans';
		background: #fafafa;

		@media screen and (max-width: 600px) {
			margin: 2px auto;
			border-radius: 0;
		}

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
			padding: 0 0 5px 0;
			border-radius: 10px;
			font-weight: 600;
			font-size: 14px;
			background: #fafafa;
			color: darkred;

			a {
				display: inline-block;
				:global(.emoji) {
					margin-bottom: 2px;
				}
			}
		}

		header {
			padding: 10px 0;
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

		.activity {
			display: flex;
			position: absolute;
			top: 10px;
			right: 40px;

			span {
				color: #444;
				font-size: 14px;
				font-weight: 600;
				margin-right: 10px;
				user-select: none;
				cursor: pointer;

				i {
					pointer-events: none;
				}
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
			padding: 0;
			overflow-wrap: break-word;
			font-size: 14px;

			:global(pre) {
				white-space: pre;
			}
		}

		:global(section > p) {
			user-select: none;
			margin: 0 0 10px 0;
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
			background: unset;
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
			background: #1a1a1a;
			color: #fff;
			border-bottom: 1px solid #222;

			time {
				a {
					color: inherit;
				}
			}

			:global(code) {
				background: maroon;
			}

			.activity {
				span {
					color: #999;
				}
			}

			.reply,
			.repost {
				background: #1a1a1a;
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
