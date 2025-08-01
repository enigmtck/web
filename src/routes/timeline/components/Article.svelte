<script lang="ts">
	import { page } from '$app/stores';
	import {
		type UserProfile,
		type Note,
		type Tag,
		type Attachment,
		DisplayNote,
		type AnnounceParams,
		type Ephemeral,
		type UserProfileTerse,
		type Activity,
		type Question,
		type Article,
		type Collection
	} from '../../../common';
	import { onDestroy, onMount, getContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { get, writable } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import {
		insertEmojis,
		timeSince,
		getWebFingerFromId,
		cachedContent,
		domainMatch,
		sleep,
		decrypt,
		isNote,
		isArticle,
		isEncryptedNote,
		isQuestion,
		compare
	} from '../../../common';
	import { replyCount, type ComposeDispatch } from './common';
	import { enigmatickWasm, appData } from '../../../stores';
	import TimeAgo from './TimeAgo.svelte';
	import FediHandle from './FediHandle.svelte';

	import { createEventDispatcher } from 'svelte';
	const replyToDispatch = createEventDispatcher<{ replyTo: ComposeDispatch }>();
	const noteSelectDispatch = createEventDispatcher<{ noteSelect: ComposeDispatch }>();

	import LinkPreview from './LinkPreview.svelte';
	import Menu from './Menu.svelte';
	import Attachments from './Attachments.svelte';
	import { json } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import Reply from './Reply.svelte';
	import Compose from './Compose.svelte';

	$: wasm = $enigmatickWasm;

	let article_id = '';
	let articleComponent: any = null;

	let showReplies: boolean = false;

	onMount(() => {
		if (wasm && note && note.note && note.note.id) {
			article_id = wasm.get_url_safe_base64(note.note.id);
		}

		// Set up intersection observer
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						// Call loadReplies directly when this article comes into view
						loadReplies();
						// Show nav gradually when article comes into view
					}
				});
			},
			{ threshold: 0.1 } // Trigger when 10% of article is visible
		);

		if (articleComponent) {
			observer.observe(articleComponent);
		}

		return () => {
			if (articleComponent) {
				observer.unobserve(articleComponent);
			}
		};
	});

	let username = $appData.username;

	export let note: DisplayNote;

	export let remove: (note: string) => void;
	export let cachedNote: (id: string) => Promise<string | undefined>;
	export let parentArticle: any = null;

	const replyToHeader = async (note: Note | Article | Question): Promise<string | null> => {
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
	};

	const announceHeader = async (
		note: Note | Article | Question
	): Promise<AnnounceParams | null> => {
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
	};

	// Helper function to find the correct profile entry that matches the Note's attributedTo
	const findMatchingProfile = (
		profiles: UserProfileTerse[],
		noteAttributedTo: string | string[] | null | undefined
	): UserProfileTerse => {
		// If noteAttributedTo is null, undefined, or an array, fall back to first profile
		if (!noteAttributedTo || Array.isArray(noteAttributedTo)) {
			return profiles[0];
		}

		// First try to find an exact match by ID
		const exactMatch = profiles.find((profile) => profile.id === noteAttributedTo);
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
	let actorId = actorTerseProfile.id;
	const messageTime = new Date(note.published || note.created_at);

	const handleUnlike = async (event: any) => {
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
	};

	const handleLike = (event: any) => {
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
	};

	const handleUnannounce = (event: any) => {
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
	};

	const handleAnnounce = (event: any) => {
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
	};

	const handleNoteSelect = (note: DisplayNote, actor: UserProfile | UserProfileTerse) => {
		console.log('DISPATCHING NOTE_SELECT');

		noteSelectDispatch('noteSelect', {
			replyToNote: note,
			replyToActor: actor,
			openAside: false
		});
	};

	const handleReplyTo = (note: DisplayNote, actor: UserProfile | UserProfileTerse) => {
		console.log('DISPATCHING REPLY_TO');
		console.log('PARENT ELEMENT');
		console.log(articleComponent);
		console.log('PARENT COMPONENT');
		console.log(parentArticle);

		replyToDispatch('replyTo', {
			replyToNote: note,
			replyToActor: actor,
			openAside: true,
			parentArticle
		});
	};

	function handleReplyToFromReply(event: CustomEvent<any>) {
		console.log('DISPATCHING REPLY_TO from REPLY');
		console.log('PARENT ELEMENT');
		console.log(articleComponent);
		console.log('PARENT COMPONENT');
		console.log(parentArticle);
		event.stopPropagation();
		const { replyToNote, replyToActor, openAside } = event.detail;
		replyToDispatch('replyTo', {
			replyToNote,
			replyToActor,
			openAside,
			parentArticle
		});
	}

	// WIP - moving reply loading here
	export async function loadReplies() {
		console.debug('Loading replies...');
		if (wasm && note.note?.id) {
			let id = note.note.id;
			const result = await wasm.get_conversation(encodeURIComponent(id), 50);
			if (!result) {
				return;
			}

			const collection: Collection = JSON.parse(result);
			await processCollectionItems(collection);
			// Force reactivity by reassigning the note
			note = note;
		}
	}

	// WIP - moving reply loading here
	const processCollectionItems = async (collection: Collection) => {
		console.debug('Processing collection items...');
		console.debug(collection);

		if (!collection.orderedItems) {
			return;
		}

		note.replies.clear();
		for (const item of collection.orderedItems) {
			if (item.object.inReplyTo) {
				await addNote(item);
			}
		}
	};

	// WIP - moving reply loading here
	const addNote = async (activity: Activity) => {
		console.debug('Adding note...');
		console.debug(activity);

		if (activity.object.attributedTo) {
			const actor = activity.object.ephemeral?.attributedTo?.at(0);

			if (actor) {
				const displayNote = new DisplayNote(actor, activity.object, activity);
				await placeNote(displayNote);
			}
		}
	};

	// WIP - moving reply loading here
	const placeNote = async (displayNote: DisplayNote) => {
		console.debug('Placing note...');
		console.debug(displayNote);

		if (displayNote.note.id && displayNote.note.inReplyTo == note.note.id) {
			console.debug('Top level...');
			note.replies.set(displayNote.note.id, displayNote);
			return;
		}

		const findAndAddReply = (map: Map<string, DisplayNote>): boolean => {
			for (const [, parentDisplayNote] of map.entries()) {
				if (parentDisplayNote.note.id === displayNote.note.inReplyTo && displayNote.note.id) {
					// Add the reply to the 'replies' Map of the matching DisplayNote
					if (!parentDisplayNote.replies.has(displayNote.note.id)) {
						parentDisplayNote.replies.set(displayNote.note.id, displayNote);
					}
					return true;
				}

				// Recursively search in the replies
				if (findAndAddReply(parentDisplayNote.replies)) {
					return true;
				}
			}
			return false;
		};

		if (displayNote.note.inReplyTo && findAndAddReply(note.replies)) {
			console.debug('Found parent...');
			return;
		}
	};

	let showExpansion = false;

	const handleArticleExpand = (event: Event) => {
		console.debug(event);
		showExpansion = !showExpansion;
	};

	const handleExpansionClose = (event: Event) => {
		// Only close if clicking the mask, not the content
		if (event.target === event.currentTarget) {
			showExpansion = false;
		}
	};

	const handleNavigate = (event: Event) => {
		console.debug(event);
		if (note.note.url) {
			window.open(note.note.url, '_blank');
		}
	};

	let target: string | null = null;
	let rel: string | null = null;

	if (note && note.note && note.note.url && !domainMatch($page.url.toString(), note.note.url)) {
		target = '_blank';
		rel = 'noreferrer';
	}

	let selectedOption: number | null = null;
	let selectedOptions: number[] = [];
	let hasVoted = false;

	function handleVote() {
		// For oneOf: selectedOption is the index of the chosen option
		// For anyOf: selectedOptions is an array of indices
		// TODO: Send vote to backend here
		hasVoted = true;
	}

	// Helper to normalize oneOf/anyOf to arrays
	function toArray<T>(val: T | T[] | undefined | null): T[] {
		return val == null ? [] : Array.isArray(val) ? val : [val];
	}

	// Precompute poll options and votes only if note.note is a Question
	$: pollOptions = isQuestion(note.note)
		? note.note.oneOf
			? toArray(note.note.oneOf)
			: note.note.anyOf
			? toArray(note.note.anyOf)
			: []
		: [];

	$: maxVotes =
		pollOptions.length > 0
			? Math.max(
					...pollOptions.map((opt) =>
						opt.replies && opt.replies.totalItems ? opt.replies.totalItems : 0
					),
					1 // avoid division by zero
			  )
			: 1;

	$: pollVotes = pollOptions.map((opt) =>
		opt.replies && opt.replies.totalItems ? opt.replies.totalItems : 0
	);

	// Replace articlePreview with articlePreviewContent in <script>:
	$: articlePreviewContent =
		note.note && isArticle(note.note) && note.note.preview && isNote(note.note.preview)
			? note.note.preview.content
			: note.note && isArticle(note.note) && note.note.summary
			? note.note.summary
			: null;

	// Add reactive reply count to ensure it updates when replies are loaded
	$: currentReplyCount = replyCount(note);
</script>

<article bind:this={articleComponent} data-conversation={note.note.id} id={article_id}>
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
					<FediHandle handle={note.note.ephemeral?.attributedTo?.[0].webfinger || ''} />
				</a>
			{/if}
		</address>
	</header>

	{#if note.activity && note.note && isEncryptedNote(note.note)}
		<section>{@html insertEmojis(wasm, decrypt(wasm, note.activity), note.note)}</section>
	{:else if articlePreviewContent}
		<section>{@html insertEmojis(wasm, articlePreviewContent || '', note.note)}</section>
	{:else if note.note && isNote(note.note) && note.note.content}
		<section>
			{@html insertEmojis(wasm, note.note.content, note.note)}
		</section>
	{:else if note.note && isQuestion(note.note) && note.note.content}
		<section class="question">
			<div class="question-content">
				{@html insertEmojis(wasm, note.note.content, note.note)}
			</div>
			{#if isQuestion(note.note) && note.note.oneOf}
				<div class="poll-bars">
					<form on:submit|preventDefault={handleVote} class="poll-form">
						{#each toArray(note.note.oneOf) as option, idx (option.name)}
							<label class="poll-option">
								<input
									type="radio"
									name="poll"
									bind:group={selectedOption}
									value={idx}
									disabled={hasVoted}
								/>
								<div class="bar-container{selectedOption === idx ? ' selected' : ''}">
									<div
										class="bar"
										style="width: {Math.round((pollVotes[idx] / maxVotes) * 100)}%;"
									/>
									<span class="option-label">{option.name}</span>
									<span class="votes-label">{pollVotes[idx]} votes</span>
								</div>
							</label>
						{/each}
						{#if note.note.endTime}
							<span class="end-time">Ends {new Date(note.note.endTime).toLocaleString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
								hour: 'numeric',
								minute: '2-digit',
								hour12: true,
								timeZoneName: 'short'
							})}</span>
						{/if}
						{#if note.note.votersCount !== undefined}
							<span class="total-voters">Total voters: {note.note.votersCount}</span>
						{/if}
						<button type="submit" disabled={hasVoted || selectedOption === null}>Vote</button>
					</form>
				</div>
			{:else if isQuestion(note.note) && note.note.anyOf}
				<div class="poll-bars">
					<form on:submit|preventDefault={handleVote} class="poll-form">
						{#each toArray(note.note.anyOf) as option, idx (option.name)}
							<label class="poll-option">
								<input
									type="checkbox"
									bind:group={selectedOptions}
									value={idx}
									disabled={hasVoted}
								/>
								<div class="bar-container{selectedOptions.includes(idx) ? ' selected' : ''}">
									<div
										class="bar"
										style="width: {Math.round((pollVotes[idx] / maxVotes) * 100)}%;"
									/>
									<span class="option-label">{option.name}</span>
									<span class="votes-label">{pollVotes[idx]} votes</span>
								</div>
							</label>
						{/each}
						{#if note.note.endTime}
							<span class="end-time">Ends {new Date(note.note.endTime).toLocaleString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
								hour: 'numeric',
								minute: '2-digit',
								hour12: true,
								timeZoneName: 'short'
							})}</span>
						{/if}
						{#if note.note.votersCount !== undefined}
							<span class="total-voters">Total voters: {note.note.votersCount}</span>
						{/if}
						<button type="submit" disabled={hasVoted || selectedOptions.length === 0}>Vote</button>
					</form>
				</div>
			{/if}
		</section>
	{/if}

	{#if note.note.attachment && note.note.attachment.length > 0}
		<Attachments note={note.note} />
	{:else if note.note.ephemeral?.metadata && note.note.ephemeral?.metadata.length}
		<LinkPreview links={note.note.ephemeral?.metadata} />
	{/if}

	{#if note.note && isArticle(note.note)}
		<div class="object-type">
			<span>Article</span>

			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<span
				><i
					class="fa-solid fa-up-right-and-down-left-from-center"
					on:click={handleArticleExpand}
					title="Expand Article"
				/><i
					class="fa-solid fa-arrow-right"
					on:click={handleNavigate}
					title="Navigate to Article"
				/>
			</span>
		</div>
	{:else if note.note && isNote(note.note)}
		<div class="object-type">
			<span>Note</span>

			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<span
				><i class="fa-solid fa-arrow-right" on:click={handleNavigate} title="Navigate to Note" />
			</span>
		</div>
	{:else if note.note && isQuestion(note.note)}
		<div class="object-type">
			<span>Question</span>

			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<span
				><!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<i class="fa-solid fa-arrow-right" on:click={handleNavigate} title="Navigate to Question" />
			</span>
		</div>
	{/if}

	{#if note.note.published}
		<time datetime={note.note.published}>
			Published {new Date(note.note.published).toLocaleString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
				timeZoneName: 'short'
			})}
		</time>
	{/if}

	<div class="visibility">
		{#if note.public}
			<span><i class="fa-solid fa-globe" /></span>
		{:else if note.note.type == 'EncryptedNote'}
			<span><i class="fa-solid fa-lock" /></span>
		{:else}
			<span><i class="fa-solid fa-at" /></span>
		{/if}

		<time datetime={note.published}>
			<a href={note.note.url} {target} {rel}>
				<!-- {timeSince(new Date(String(note.published)).getTime())} -->
				<TimeAgo timestamp={messageTime} />
			</a>
		</time>
	</div>
	{#if username}
		<nav>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<span class="comments" on:click|preventDefault={() => (showReplies = !showReplies)}>
				<i class="fa-solid fa-comments" />
				{#if note.replies?.size}
					{currentReplyCount}
				{/if}
			</span>

			<span>
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
				{note.note.ephemeral?.announces?.length || ''}
			</span>

			<span>
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
				{note.note.ephemeral?.likes?.length || ''}
			</span>

			{#if note.actor}
				<span>
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-reply" on:click={() => handleReplyTo(note, note.actor)} />
				</span>
			{/if}

			{#if note.note.id}
				{#await wasm?.get_ap_id() then ap_id}
					<Menu
						{remove}
						reload={loadReplies}
						object={note.note.id}
						owner={ap_id == note.note.attributedTo}
					/>
				{/await}
			{/if}
		</nav>
	{/if}

	{#if showReplies && note.replies?.size}
		<div class="replies" in:fade={{ duration: 300, delay: 100 }}>
			{#each Array.from(note.replies.values()).sort(compare).reverse() as reply}
				<Reply {remove} note={reply} {username} on:replyTo={handleReplyToFromReply} />
			{/each}
		</div>
	{/if}
	{#if showExpansion}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="expansion-mask" on:click={handleExpansionClose} />
		<div class="expansion" on:click={handleExpansionClose}>
			<div class="expansion-content">
				{#if note.note && isArticle(note.note)}
					{#if note.note.name}
						<h1 class="expansion-title">{@html insertEmojis(wasm, note.note.name, note.note)}</h1>
					{/if}
					{#if note.note.content}
						{@html insertEmojis(wasm, note.note.content, note.note)}
					{/if}
				{:else if note.note && isNote(note.note) && note.note.content}
					{@html insertEmojis(wasm, note.note.content, note.note)}
				{:else if note.note && isQuestion(note.note) && note.note.content}
					{@html insertEmojis(wasm, note.note.content, note.note)}
				{/if}
			</div>
		</div>
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
		padding: 15px;
		font-family: 'Open Sans';
		background: #fafafa;

		@media screen and (max-width: 600px) {
			margin: 2px auto;
			border-radius: 0;
		}

		:global(section pre) {
			background: #eee;
			padding: 10px;
			white-space: pre-wrap;

			:global(code) {
				padding: 0;
				white-space: pre-wrap;
				background: unset;
			}
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
			margin: 0 0 10px 0;
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
			padding: 0 0 10px 0;
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

		.visibility {
			display: flex;
			flex-direction: row-reverse;
			position: absolute;
			top: 15px;
			right: 15px;

			span {
				display: inline-block;
				color: #444;
				font-size: 14px;
				font-weight: 600;
				user-select: none;
				pointer-events: none;

				i.fa-globe {
					color: #5cb3ff;
				}

				i.fa-lock {
					color: goldenrod;
				}

				i.fa-at {
					color: red;
				}
			}

			time {
				display: inline-block;
				font-style: normal;
				font-size: 14px;
				text-decoration: none;
				color: inherit;
				font-weight: 600;
				margin: 0 10px;

				a {
					color: inherit;
				}
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

			:global(img) {
				max-width: 100%;
				height: auto;
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

		.object-type {
			display: flex;
			flex-direction: row;
			align-items: center;
			color: #aaa;
			font-size: 13px;
			font-weight: 600;
			margin-top: 10px;

			span:last-child {
				padding: 0 10px;
				border-radius: 10px;
				background: #f0f0f0;
				color: #777;
				font-weight: 600;
				margin-left: 10px;

				i {
					margin: 0 5px;
				}

				i:hover {
					cursor: pointer;
				}
			}
		}

		time {
			display: inline-block;
			font-size: 13px;
			color: #aaa;
			font-weight: 600;
		}

		nav {
			width: 100%;
			position: relative;
			z-index: unset;
			background: unset;
			padding: 10px 0 0 0;
			margin: 5px 0 0 0;
			display: flex;
			flex-direction: row;
			transition-duration: 300ms;
			border-top: 1px solid #aaa;

			span {
				font-size: 14px;
				width: calc(100% / 5);
				text-align: center;

				i {
					margin-right: 5px;
					font-size: 14px;
					color: #999;
				}

				i.selected {
					color: goldenrod;
				}

				i:hover {
					cursor: pointer;
				}
			}
		}

		.expansion-mask {
			width: 100dvw;
			height: 100dvh;
			position: fixed;
			top: 0;
			left: 0;
			z-index: 1000;
			background: #000;
			opacity: 0.9;
		}

		.expansion {
			width: 100dvw;
			height: 100dvh;
			position: fixed;
			top: 0;
			left: 0;
			z-index: 1001;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.expansion-content {
			width: 95%;
			max-width: 1000px;
			height: 100vh;
			background: #fff;
			padding: 0 20px;
			overflow-y: auto;
			overflow-x: hidden;
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
			word-wrap: break-word;
			overflow-wrap: break-word;
			border-color: #ddd;
			border-style: solid;
			border-width: 0 1px;

			:global(img) {
				max-width: 100%;
				height: auto;
			}

			:global(figure) {
				text-align: center;
				margin: 1em 0;
			}

			:global(figure img) {
				display: block;
				margin: 0 auto;
			}

			:global(pre) {
				white-space: pre-wrap;
				word-break: break-word;
				max-width: 100%;
				overflow-x: auto;
			}

			:global(code) {
				white-space: pre-wrap;
				word-break: break-word;
			}

			:global(h1), :global(h2), :global(h3), :global(h4), :global(h5), :global(h6) {
				color: #aaa;
			}
		}
	}

	.poll-form {
		margin-top: 1em;
	}
	.poll-option {
		display: block;
		margin-bottom: 0.5em;
		cursor: pointer;
		position: relative;
	}
	.bar-container {
		display: flex;
		align-items: center;
		position: relative;
		height: 2em;
		background: #f0f0f0;
		overflow: hidden;
		border-radius: 1em;
	}
	.bar {
		background: linear-gradient(90deg, darkgoldenrod, goldenrod);
		height: 100%;
		transition: width 0.4s;
		border-radius: 1em;
	}
	.option-label {
		position: absolute;
		left: 1em;
		z-index: 1;
		color: #222;
		font-weight: 600;
		pointer-events: none;
	}
	.votes-label {
		position: absolute;
		right: 1em;
		z-index: 1;
		color: #555;
		font-size: 0.9em;
		pointer-events: none;
	}
	.poll-option input[type='radio'],
	.poll-option input[type='checkbox'] {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		z-index: 2;
		display: none;
	}
	.bar-container.selected .bar {
		box-shadow: 0 0 0 3px goldenrod, 0 2px 8px #ffd70055;
		background: linear-gradient(90deg, darkred, red);
	}
	.bar-container.selected {
		outline: 2px solid goldenrod;
		outline-offset: -2px;
	}

	button[type='submit'] {
		background: darkred;
		color: #fff;
		border: none;
		border-radius: 10px;
		padding: 0.5em 2em;
		font-size: 1em;
		font-weight: 600;
		margin: 0 auto 1.5em auto;
		display: block;
		cursor: pointer;
		transition: background 0.2s, color 0.2s, box-shadow 0.2s;
		box-shadow: none;
		outline: none;
	}
	button[type='submit']:hover:not(:disabled) {
		background: red;
		box-shadow: 0 2px 8px #ff525233;
	}
	button[type='submit']:active:not(:disabled) {
		background: #2a0000;
		color: goldenrod;
	}
	button[type='submit']:disabled {
		background: #333;
		color: #888;
		cursor: not-allowed;
		box-shadow: none;
	}

	.poll-bars {
		position: relative;
	}

	.end-time {
		display: block;
		text-align: left;
		font-size: 0.8em;
		color: #222;
		margin-top: 0.2em;
		font-weight: 600;
	}
	
	.total-voters {
		display: block;
		font-size: 0.8em;
		color: #222;
		margin-top: 0.2em;
		text-align: left;
		margin-right: 5px;
		font-weight: 600;
	}

	:global(body.dark) {
		a {
			color: darkgoldenrod;
		}

		a:hover {
			color: red;
		}

		.expansion-content {
			background: #111;
			color: #ccc;
			border-color: #222;

			:global(h1), :global(h2), :global(h3), :global(h4), :global(h5), :global(h6) {
				color: #555;
			}
		}

		article {
			background: #1a1a1a;
			color: #fff;
			border-bottom: 1px solid #222;

			time {
				a {
					color: inherit;
				}

				color: #777;
			}

			.visibility {
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

			:global(section pre) {
				background: #111;

				:global(code) {
					background: unset;
				}
			}

			.object-type {
				color: #777;

				span:last-child {
					background: #333;
					color: #777;
				}
			}

			nav {
				background: unset;
				border-top: 1px solid #333;

				span {
					color: #777;
				}

				i {
					color: #777;
				}

				i.selected {
					color: goldenrod;
				}
			}
		}

		.replies {
			margin-top: 10px;

			article {
				address {
					a {
						color: #ddd;
					}
				}
			}
		}

		.total-voters {
			color: #777;
		}

		.end-time {
			color: #777;
		}	

		.bar-container {
			background: #333;
		}

		.bar {
			background: darkred;
		}

		.votes-label {
			color: white;
		}

		.option-label {
			color: white;
		}

		.bar-container.selected .bar {
			box-shadow: 0 0 0 3px darkgoldenrod, 0 2px 8px #ffd70055;
		}

		.bar-container.selected {
			outline: 2px solid darkgoldenrod;
		}
	}
</style>
