<script lang="ts">
	import { page } from '$app/stores';
	import type {
		UserProfile,
		Note,
		Tag,
		Attachment,
		DisplayNote,
		AnnounceParams,
		Ephemeral,
		UserProfileTerse,
		Activity
	} from '../../../common';
	import { onDestroy, onMount, getContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { get, writable } from 'svelte/store';
	import {
		insertEmojis,
		timeSince,
		getWebFingerFromId,
		cachedContent,
		domainMatch,
		sleep,
		decrypt
	} from '../../../common';
	import { replyCount, ComposeDispatch } from './common';
	import { enigmatickWasm } from '../../../stores';
	import TimeAgo from './TimeAgo.svelte';
	import FediHandle from './FediHandle.svelte';

	import { createEventDispatcher } from 'svelte';
	const replyToDispatch = createEventDispatcher<{ replyTo: ComposeDispatch }>();
	const noteSelectDispatch = createEventDispatcher<{ noteSelect: ComposeDispatch }>();

	import LinkPreview from './LinkPreview.svelte';
	import Menu from './Menu.svelte';
	import Attachments from './Attachments.svelte';
	import { json } from '@sveltejs/kit';

	$: wasm = $enigmatickWasm;

	onMount(() => {
		if (wasm && note && note.note && note.note.id) {
			article_id = wasm.get_url_safe_base64(note.note.id);
		}
	});

	export let note: DisplayNote;
	export let username: string | null | undefined;
	// export let replyToHeader: string | null;
	// export let announceHeader: AnnounceParams | null;
	export let renderAction: (node: any) => void;
	export let refresh: () => void;
	export let remove: (note: string) => void;
	export let cachedNote: (id: string) => Promise<string | undefined>;

	async function replyToHeader(note: Note): Promise<string | null> {
		if (note.inReplyTo) {
			const replyNote = await cachedNote(note.inReplyTo);

			if (replyNote) {
				const note: Note = JSON.parse(String(replyNote));
				const replyActor = note.ephemeral?.attributedTo?.at(0);

				if (replyActor && wasm) {
					const name = insertEmojis(
						wasm,
						replyActor.name || replyActor.preferredUsername,
						replyActor
					);

					return name;
				} else {
					return null;
				}
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	async function announceHeader(note: Note): Promise<AnnounceParams | null> {
		if (note.ephemeral?.announces) {
			const announceActor = note.ephemeral.announces[0];
			let others = '';

			if (note.ephemeral.announces.length == 2) {
				others = ` and ${note.ephemeral.announces.length - 1} other`;
			} else if (note.ephemeral.announces.length > 2) {
				others = ` and ${note.ephemeral.announces.length - 1} others`;
			}

			if (announceActor && wasm) {
				const name = insertEmojis(
					wasm,
					announceActor.name || announceActor.preferredUsername,
					announceActor
				);

				return <AnnounceParams>{ url: announceActor.url, name, others };
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	let profile = note.note.ephemeral?.attributedTo ?? [note.actor];
	let actorIcon = profile[0].icon?.url;
	let actorName = profile[0].name ?? profile[0].preferredUsername;
	let actorId = profile[0].id;
	let actorTerseProfile = profile[0];
	const messageTime = new Date(note.published || note.created_at);

	function handleUnlike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);
		const activity: string = String(event.target.dataset.activity);

		console.debug(`UNDOING ${activity}`);

		if (wasm) {
			wasm.send_unlike(actor, object, activity).then((uuid) => {
				console.debug('UNLIKE SENT');
				let ephemeral: Ephemeral = note.note.ephemeral || {};
				ephemeral.liked = null;
				note.note.ephemeral = ephemeral;
				note = note;
			});
		}
	}

	function handleLike(event: any) {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);

		if (wasm) {
			wasm.send_like(actor, object).then((x) => {
				console.debug(x);

				if (x) {
					let activity: Activity = JSON.parse(x);
					console.debug(`Like sent: ${activity.id}`);
					let ephemeral: Ephemeral = note.note.ephemeral || {};
					ephemeral.liked = activity.id;
					note.note.ephemeral = ephemeral;
					note = note;
				}
			});
		}
	}

	function handleUnannounce(event: any) {
		const object: string = String(event.target.dataset.object);
		const activity: string = String(event.target.dataset.activity);

		if (wasm && object) {
			wasm.send_unannounce(object, activity).then((id) => {
				console.debug(`Undo Announce sent: ${id}`);
				let ephemeral: Ephemeral = note.note.ephemeral || {};
				ephemeral.announced = null;
				note.note.ephemeral = ephemeral;
				note = note;
			});
		} else {
			console.error('Object invalid');
		}
	}

	function handleAnnounce(event: any) {
		const object: string = String(event.target.dataset.object);

		if (wasm && object) {
			wasm.send_announce(object).then((x) => {
				console.debug(x);

				if (x) {
					let activity: Activity = JSON.parse(x);
					console.debug(`Announce sent: ${activity.id}`);
					let ephemeral: Ephemeral = note.note.ephemeral || {};
					ephemeral.announced = activity.id;
					note.note.ephemeral = ephemeral;
					note = note;
				}
			});
		} else {
			console.error('Object invalid');
		}
	}

	function handleNoteSelect(note: Note, actor: UserProfile | UserProfileTerse) {
		console.log('DISPATCHING NOTE_SELECT');

		noteSelectDispatch('noteSelect', {
			replyToNote: note,
			replyToActor: actor,
			openAside: false
		});
	}

	function handleReplyTo(note: Note, actor: UserProfile | UserProfileTerse) {
		console.log('DISPATCHING REPLY_TO');

		replyToDispatch('replyTo', {
			replyToNote: note,
			replyToActor: actor,
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
	{#if wasm}
		{#await replyToHeader(note.note) then header}
			{#if header}
				<span class="reply">
					<i class="fa-solid fa-reply" /> In
					<a href={note.note.inReplyTo} target="_blank" rel="noreferrer">reply</a>
					to {@html header}
				</span>
			{/if}
		{/await}
		{#await announceHeader(note.note) then header}
			{#if header}
				<span class="repost">
					<i class="fa-solid fa-retweet" /> Reposted by
					<a href={header.url}>{@html header.name}</a>{header.others}
				</span>
			{/if}
		{/await}
	{/if}

	<header>
		<div>
			{#if actorIcon}
				<img src={cachedContent(wasm, actorIcon)} alt="Sender" on:error={(e) => console.log(e)} />
			{/if}
		</div>
		<address>
			{#if actorName && actorTerseProfile}
				<span>{@html insertEmojis(wasm, actorName, actorTerseProfile)}</span>
				<a href="/{getWebFingerFromId(actorTerseProfile)}">
					<!--{getWebFingerFromId(actorTerseProfile)}-->
					<FediHandle handle={getWebFingerFromId(actorTerseProfile)} />
				</a>
			{/if}
		</address>
	</header>

	{#if note.activity}
		<section>{@html insertEmojis(wasm, decrypt(wasm, note.activity), note.note)}</section>
	{:else if note.note && note.note.content}
		<section>{@html insertEmojis(wasm, note.note.content, note.note)}</section>
	{/if}

	{#if note.note.attachment && note.note.attachment.length > 0}
		<Attachments note={note.note} />
	{:else if note.note.ephemeral?.metadata && note.note.ephemeral?.metadata.length}
		<LinkPreview links={note.note.ephemeral?.metadata} />
	{/if}

	<div class="activity">
		{#if note.note.ephemeral?.likes?.length}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<span class="likes"
				><i class="fa-solid fa-star" />
				{note.note.ephemeral?.likes.length}</span
			>
		{/if}
		{#if note.replies?.size}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<span class="comments" on:click|preventDefault={() => handleNoteSelect(note.note, note.actor)}
				><i class="fa-solid fa-comments" />
				{replyCount(note)}</span
			>
		{/if}
	</div>
	<time datetime={note.published}>
		<a href={note.note.url} {target} {rel}>
			<!-- {timeSince(new Date(String(note.published)).getTime())} -->
			<TimeAgo timestamp={messageTime} />
		</a>
	</time>
	{#if username}
		<nav>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<i
				class="fa-solid fa-expand"
				on:click|preventDefault={() => handleNoteSelect(note.note, note.actor)}
			/>

			{#if note.note.ephemeral?.announced}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<i
					class="fa-solid fa-repeat selected"
					data-object={note.note.id}
					data-activity={note.note.ephemeral?.announced}
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

			{#if note.note.ephemeral?.liked}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<i
					class="fa-solid fa-star selected"
					data-actor={note.note.attributedTo}
					data-object={note.note.id}
					data-activity={note.note.ephemeral?.liked}
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
				<i class="fa-solid fa-reply" on:click={() => handleReplyTo(note.note, note.actor)} />
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

		:global(code) {
			background: darkgoldenrod;
			color: #fff;
			padding: 0 5px;
		}

		a {
			color: darkgoldenrod;
		}

		a:hover {
			color: red;
		}

		.reply,
		.repost {
			width: calc(100% - 50px);
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
				display: inline;
				:global(.emoji) {
					margin-bottom: 2px;
				}
			}
		}

		header {
			padding: 10px 0;
			margin-top: 10px;
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
				min-width: 55px;
			}

			img {
				width: 100%;
				clip-path: inset(0 0 0 0 round 20%);
			}

			address {
				position: relative;
				width: 100%;
				padding: 0 0 0 15px;
				overflow: hidden;
				text-overflow: ellipsis;

				span {
					display: inline;
					white-space: nowrap;
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
			font-size: 16px;
			text-decoration: none;
		}

		:global(address > span) {
			position: relative;
			width: 100%;
		}

		address > a {
			color: #777;
			font-weight: 400;
			width: 100%;
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
			overflow: hidden;
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
