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
		type Collection,
		type Link
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
		compare,
		getFirstValue,
		toArray
	} from '../../../common';
	import { replyCount, type ComposeDispatch } from './common';
	import { enigmatickWasm, appData } from '../../../stores';
	import TimeAgo from './TimeAgo.svelte';
	import FediHandle from './FediHandle.svelte';

	let { 
		onReplyTo = undefined,
		onNoteSelect = undefined,
		note,
		remove,
		cachedNote,
		parentArticle = null
	}: {
		onReplyTo?: ((dispatch: ComposeDispatch) => void);
		onNoteSelect?: ((dispatch: ComposeDispatch) => void);
		note: DisplayNote;
		remove: (note: string) => void;
		cachedNote: (id: string) => Promise<string | undefined>;
		parentArticle?: any;
	} = $props();

	import LinkPreview from './LinkPreview.svelte';
	import Menu from './Menu.svelte';
	import Attachments from './Attachments.svelte';
	import { json } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import Reply from './Reply.svelte';
	import Compose from './Compose.svelte';

	let wasm = $derived($enigmatickWasm);

	let article_id = $state('');
	let articleComponent: any = null;

	let showReplies = $state(false);

	// Track if replies have been loaded for this specific note to avoid duplicate loads
	let repliesLoadedNoteId = $state<string | null>(null);
	let observer: IntersectionObserver | null = null;

	// Get current note ID
	let currentNoteId = $derived(note?.note?.id);

	onMount(() => {
		if (wasm && note && note.note && note.note.id) {
			article_id = wasm.get_url_safe_base64(note.note.id);
		}

		// Initialize the tracked map reference
		repliesMapRef = note.replies;

		// Set up intersection observer when articleComponent is available
		const setupObserver = async () => {
			await tick();
			
			if (!articleComponent) {
				// Retry after a short delay if still not available
				setTimeout(setupObserver, 100);
				return;
			}

			// Set up intersection observer
			observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							// Check if we need to load for this note
							const noteId = note?.note?.id;
							const currentWasm = wasm;
							if (currentWasm && noteId && repliesLoadedNoteId !== noteId) {
								// Call loadReplies directly when this article comes into view
								loadReplies(false).catch(err => {
									console.error('Error loading replies from intersection observer:', err);
								});
							}
						}
					});
				},
				{ threshold: 0.1 } // Trigger when 10% of article is visible
			);

			observer.observe(articleComponent);

			// Also check if element is already visible and load immediately
			const rect = articleComponent.getBoundingClientRect();
			const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
			const noteId = note?.note?.id;
			const currentWasm = wasm;
			if (isVisible && currentWasm && noteId && repliesLoadedNoteId !== noteId) {
				loadReplies(false).catch(err => {
					console.error('Error loading replies on mount:', err);
				});
			}
		};

		setupObserver();

		return () => {
			if (observer && articleComponent) {
				observer.unobserve(articleComponent);
			}
		};
	});

	// Use $effect to load replies when wasm becomes available and note is visible
	$effect(() => {
		// Track wasm availability and note ID
		const _wasm = wasm;
		const noteId = currentNoteId;
		
		if (_wasm && noteId && repliesLoadedNoteId !== noteId) {
			// Use a small delay to ensure articleComponent is bound
			const timeoutId = setTimeout(() => {
				if (articleComponent) {
					const rect = articleComponent.getBoundingClientRect();
					const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
					
					if (isVisible && repliesLoadedNoteId !== noteId) {
						loadReplies(false).catch(err => {
							console.error('Error loading replies from effect:', err);
						});
					}
				}
			}, 200);
			
			return () => clearTimeout(timeoutId);
		}
	});

	let username = $appData.username;

	const replyToHeader = async (note: Note | Article | Question): Promise<string | null> => {
		if (note.inReplyTo) {
			const replyNote = await cachedNote(note.inReplyTo);

			if (replyNote) {
				const note: Note = JSON.parse(String(replyNote));
				const replyActor = getFirstValue(note.ephemeral?.attributedTo);

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
	let handleValue = $derived(getFirstValue(note.note.ephemeral?.attributedTo)?.webfinger || '');

	const handleUnlike = async (event: any) => {
		const object: string = String(event.target.dataset.object);
		const actor: string = String(event.target.dataset.actor);
		const activity: string = String(event.target.dataset.activity);

		//console.debug(`UNDOING ${activity}`);

		if (wasm) {
			wasm.send_unlike(actor, object, activity).then((uuid) => {
				//console.debug('UNLIKE SENT');
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
				//console.debug(x);

				if (x) {
					let activity: Activity = JSON.parse(x);
					//console.debug(`Like sent: ${activity.id}`);
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
				//console.debug(`Undo Announce sent: ${id}`);
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
				//console.debug(x);

				if (x) {
					let activity: Activity = JSON.parse(x);
					//console.debug(`Announce sent: ${activity.id}`);
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

	const handleReplyTo = (note: DisplayNote, actor: UserProfile | UserProfileTerse) => {
		//console.log('DISPATCHING REPLY_TO');
		//console.log('PARENT ELEMENT');
		//console.log(articleComponent);
		//console.log('PARENT COMPONENT');
		//console.log(parentArticle);

		onReplyTo?.({
			replyToNote: note,
			replyToActor: actor,
			openAside: true,
			parentArticle
		});
	};

	function handleReplyToFromReply(dispatch: ComposeDispatch) {
		//console.log('DISPATCHING REPLY_TO from REPLY');
		//console.log('PARENT ELEMENT');
		//console.log(articleComponent);
		//console.log('PARENT COMPONENT');
		//console.log(parentArticle);
		onReplyTo?.({
			...dispatch,
			parentArticle
		});
	}

	export async function loadReplies(force = false) {
		const noteId = note.note?.id;
		if (!noteId) return;
		
		if (force) {
			repliesLoadedNoteId = null;
		}
		
		// Only load if we haven't loaded for this note ID yet, or if forcing
		if (wasm && (repliesLoadedNoteId !== noteId || force)) {
			const result = await wasm.get_conversation(encodeURIComponent(noteId), 50);
			if (!result) {
				return;
			}

			const collection: Collection = JSON.parse(result);
			await processCollectionItems(collection);
			repliesLoadedNoteId = noteId;
		}
	}

	const processCollectionItems = async (collection: Collection) => {
		if (!collection.orderedItems) {
			return;
		}

		// Create new Map and update the tracked reference directly
		// This ensures reactivity works properly
		repliesMapRef = new Map();
		
		// Process all items
		for (const item of collection.orderedItems) {
			if (item.object.inReplyTo) {
				await addNote(item);
			}
		}
		
		// Force reactivity by creating a new Map reference with all current replies
		// This ensures nested Maps are properly tracked
		repliesMapRef = new Map(repliesMapRef);
		// Update note.replies so parent component sees the changes
		note.replies = repliesMapRef;
		await tick();
	};

	const addNote = async (activity: Activity) => {
		if (activity.object.attributedTo) {
			const actor = getFirstValue(activity.object.ephemeral?.attributedTo);

			if (actor) {
				const displayNote = new DisplayNote(actor, activity.object, activity);
				await placeNote(displayNote);
			}
		}
	};

	const placeNote = async (displayNote: DisplayNote) => {
		if (displayNote.note.id && displayNote.note.inReplyTo == note.note.id) {
			// Force reactivity by creating new Map instance
			repliesMapRef = new Map(repliesMapRef).set(displayNote.note.id, displayNote);
			// Update note.replies so parent component sees the changes
			note.replies = repliesMapRef;
			return;
		}

		const findAndAddReply = (map: Map<string, DisplayNote>): boolean => {
			for (const [, parentDisplayNote] of map.entries()) {
				if (parentDisplayNote.note.id === displayNote.note.inReplyTo && displayNote.note.id) {
					// Add the reply to the 'replies' Map of the matching DisplayNote
					if (!parentDisplayNote.replies.has(displayNote.note.id)) {
						// Force reactivity by creating new Map instance for nested reply
						parentDisplayNote.replies = new Map(parentDisplayNote.replies).set(displayNote.note.id, displayNote);
						// Update the main replies Map reference to trigger reactivity for nested changes
						repliesMapRef = new Map(repliesMapRef);
						// Update note.replies so parent component sees the changes
						note.replies = repliesMapRef;
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
			return;
		}
	};

	let showExpansion = $state(false);

	const handleArticleExpand = (event: Event) => {
		//console.debug(event);
		showExpansion = !showExpansion;
	};

	const handleExpansionClose = (event: Event) => {
		// Only close if clicking the mask, not the content
		if (event.target === event.currentTarget) {
			showExpansion = false;
		}
	};

	const handleNavigate = (event: Event) => {
		//console.debug(event);
		const url = extractUrl(note.note.url);
		if (url) {
			window.open(url, '_blank');
		}
	};

	let target = $state<string | null>(null);
	let rel = $state<string | null>(null);

	const noteUrl = extractUrl(note.note.url);
	if (note && note.note && noteUrl && !domainMatch($page.url.toString(), noteUrl)) {
		target = '_blank';
		rel = 'noreferrer';
	}

	let selectedOption = $state<number | null>(null);
	let selectedOptions = $state<number[]>([]);
	let hasVoted = $state(false);

	async function handleVote() {
		// For oneOf: selectedOption is the index of the chosen option
		// For anyOf: selectedOptions is an array of indices
		
		if (!wasm || !note.note.id) {
			return;
		}

		const questionAuthor = getFirstValue(note.note.attributedTo);
		if (!questionAuthor) {
			return;
		}

		try {
			if (isQuestion(note.note) && note.note.oneOf && selectedOption !== null) {
				// Single choice question
				const option = pollOptions[selectedOption];
				if (option) {
					await wasm.send_vote(option.name, note.note.id, questionAuthor);
				}
			} else if (isQuestion(note.note) && note.note.anyOf && selectedOptions.length > 0) {
				// Multiple choice question - send a vote for each selected option
				for (const optionIndex of selectedOptions) {
					const option = pollOptions[optionIndex];
					if (option) {
						await wasm.send_vote(option.name, note.note.id, questionAuthor);
					}
				}
			}
			
			hasVoted = true;
		} catch (error) {
			console.error('Error sending vote:', error);
		}
	}



	// Helper to extract URL from url field (supports Link objects and strings)
	function extractUrl(urlField: Link[] | Link | string[] | string | undefined | null): string | null {
		if (!urlField) return null;
		
		if (Array.isArray(urlField)) {
			// If it's an array, take the first item
			const firstItem = urlField[0];
			if (typeof firstItem === 'string') {
				return firstItem;
			} else if (firstItem && typeof firstItem === 'object' && 'href' in firstItem) {
				return firstItem.href || null;
			}
			return null;
		} else if (typeof urlField === 'string') {
			// If it's a string, return it directly
			return urlField;
		} else if (typeof urlField === 'object' && 'href' in urlField) {
			// If it's a Link object, return the href
			return urlField.href || null;
		}
		
		return null;
	}

	// Precompute poll options and votes only if note.note is a Question
	let pollOptions = $derived(isQuestion(note.note)
		? note.note.oneOf
			? toArray(note.note.oneOf)
			: note.note.anyOf
			? toArray(note.note.anyOf)
			: []
		: []);

	let maxVotes = $derived(
		pollOptions.length > 0
			? Math.max(
					...pollOptions.map((opt) =>
						opt.replies && opt.replies.totalItems ? opt.replies.totalItems : 0
					),
					1 // avoid division by zero
			  )
			: 1
	);

	let pollVotes = $derived(pollOptions.map((opt) =>
		opt.replies && opt.replies.totalItems ? opt.replies.totalItems : 0
	));

	// Replace articlePreview with articlePreviewContent in <script>:
	let articlePreviewContent = $derived(
		note.note && isArticle(note.note) && note.note.preview && isNote(note.note.preview)
			? note.note.preview.content
			: note.note && isArticle(note.note) && note.note.summary
			? note.note.summary
			: null
	);

	// Add reactive reply count to ensure it updates when replies are loaded
	// Use repliesMapRef instead of note.replies to ensure reactivity
	// Re-implement replyCount logic using repliesMapRef
	let currentReplyCount = $derived.by(() => {
		if (!repliesMapRef) return 0;
		// Track the size to ensure reactivity
		const map = repliesMapRef;
		const size = map.size;
		
		// Recursively count all replies (including nested)
		let count = size;
		const countReplies = (replyMap: Map<string, DisplayNote>): number => {
			let nestedCount = 0;
			replyMap.forEach((reply) => {
				if (reply.replies && reply.replies.size > 0) {
					nestedCount += reply.replies.size;
					nestedCount += countReplies(reply.replies);
				}
			});
			return nestedCount;
		};
		
		count += countReplies(map);
		return count;
	});
	
	// Track the replies Map as reactive state
	// Initialize from prop, but manage it as internal state for reactivity
	let repliesMapRef = $state(note.replies);
	
	// Sync repliesMapRef with note.replies when the note prop changes
	$effect(() => {
		// Only update if the reference actually changed (not just content)
		if (note.replies !== repliesMapRef) {
			repliesMapRef = note.replies;
		}
	});
	
	// Create reactive array from replies Map
	// Since we update repliesMapRef whenever nested replies change, we just need to track the map reference
	let repliesArray = $derived.by(() => {
		const map = repliesMapRef;
		if (!map) return [];
		// Track map.size to ensure reactivity when replies are added/removed
		const _ = map.size;
		return Array.from(map.values());
	});
	
	// Derived sorted array - don't mutate repliesArray in template
	let sortedRepliesArray = $derived.by(() => {
		// Create a copy before sorting to avoid mutating state
		return [...repliesArray].sort(compare).reverse();
	});
	
	
</script>

<article bind:this={articleComponent} data-conversation={note.note.id} id={article_id}>
	{#if wasm}
		{#await replyToHeader(note.note) then header}
			{#if header}
				<span class="reply">
					<i class="fa-solid fa-reply"></i> In
					<a href={note.note.inReplyTo} target="_blank" rel="noreferrer">reply</a>
					to {@html header}
				</span>
			{/if}
		{/await}
		{#await announceHeader(note.note) then header}
			{#if header}
				<span class="repost">
					<i class="fa-solid fa-retweet"></i> Reposted by
					<a href={header.url}>{@html header.name}</a>{header.others}
				</span>
			{/if}
		{/await}
	{/if}

	<header>
		<div>
			{#if actorIcon}
				<img src={cachedContent(wasm, actorIcon)} alt="Sender" onerror={(e) => console.log(e)} />
			{/if}
		</div>
		<address>
			{#if actorName && actorTerseProfile}
				<span>{@html insertEmojis(wasm, actorName, actorTerseProfile)}</span>
				<a href="/{getWebFingerFromId(actorTerseProfile)}">
					<FediHandle handle={handleValue} />
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
					<form onsubmit={(e) => { e.preventDefault(); handleVote(); }} class="poll-form">
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
									></div>
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
					<form onsubmit={(e) => { e.preventDefault(); handleVote(); }} class="poll-form">
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
									></div>
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

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				>				<i
					class="fa-solid fa-up-right-and-down-left-from-center"
					role="button"
					tabindex="0"
					onclick={handleArticleExpand}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleArticleExpand(e); } }}
					title="Expand Article"
				></i><i
					class="fa-solid fa-arrow-right"
					role="button"
					tabindex="0"
					onclick={handleNavigate}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate(e); } }}
					title="Navigate to Article"
				></i>
			</span>
		</div>
	{:else if note.note && isNote(note.note)}
		<div class="object-type">
			<span>Note</span>

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				><i class="fa-solid fa-arrow-right" role="button" tabindex="0" onclick={handleNavigate} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate(e); } }} title="Navigate to Note"></i>
			</span>
		</div>
	{:else if note.note && isQuestion(note.note)}
		<div class="object-type">
			<span>Question</span>

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				><!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<i class="fa-solid fa-arrow-right" role="button" tabindex="0" onclick={handleNavigate} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate(e); } }} title="Navigate to Question"></i>
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
			<span><i class="fa-solid fa-globe"></i></span>
		{:else if note.note.type == 'EncryptedNote'}
			<span><i class="fa-solid fa-lock"></i></span>
		{:else}
			<span><i class="fa-solid fa-at"></i></span>
		{/if}

		<time datetime={note.published}>
			<a href={extractUrl(note.note.url)} {target} {rel}>
				<!-- {timeSince(new Date(String(note.published)).getTime())} -->
				<TimeAgo timestamp={messageTime} />
			</a>
		</time>
	</div>
	{#if username}
		<nav>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="comments" role="button" tabindex="0" onclick={(e) => { e.preventDefault(); showReplies = !showReplies; }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showReplies = !showReplies; } }}>
				<i class="fa-solid fa-comments"></i>
				{#if currentReplyCount > 0}
					{currentReplyCount}
				{/if}
			</span>

			<span>
				{#if note.note.ephemeral?.announced}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<i
						class="fa-solid fa-repeat selected"
						role="button"
						tabindex="0"
						data-object={note.note.id}
						data-activity={note.note.ephemeral?.announced}
						onclick={(e) => { e.preventDefault(); handleUnannounce(e); }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUnannounce(e); } }}
					></i>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<i
						class="fa-solid fa-repeat"
						role="button"
						tabindex="0"
						data-object={note.note.id}
						onclick={(e) => { e.preventDefault(); handleAnnounce(e); }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAnnounce(e); } }}
					></i>
				{/if}
				{note.note.ephemeral?.announces?.length || ''}
			</span>

			<span>
				{#if note.note.ephemeral?.liked}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<i
						class="fa-solid fa-star selected"
						role="button"
						tabindex="0"
						data-actor={getFirstValue(note.note.attributedTo)}
						data-object={note.note.id}
						data-activity={note.note.ephemeral?.liked}
						onclick={(e) => { e.preventDefault(); handleUnlike(e); }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUnlike(e); } }}
					></i>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<i
						class="fa-solid fa-star"
						role="button"
						tabindex="0"
						data-actor={getFirstValue(note.note.attributedTo)}
						data-object={note.note.id}
						onclick={(e) => { e.preventDefault(); handleLike(e); }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLike(e); } }}
					></i>
				{/if}
				{note.note.ephemeral?.likes?.length || ''}
			</span>

			{#if note.actor}
				<span>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<i class="fa-solid fa-reply" role="button" tabindex="0" onclick={() => handleReplyTo(note, note.actor)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReplyTo(note, note.actor); } }}></i>
				</span>
			{/if}

			{#if note.note.id}
				{#await wasm?.get_ap_id() then ap_id}
					<Menu
						{remove}
						reload={() => loadReplies(true)}
						object={note.note.id}
						owner={ap_id == note.note.attributedTo}
					/>
				{/await}
			{/if}
		</nav>
	{/if}

	{#if showReplies}
		{#if sortedRepliesArray.length > 0}
			<div class="replies" in:fade={{ duration: 300, delay: 100 }}>
				{#each sortedRepliesArray as reply}
					<Reply {remove} note={reply} {username} onReplyTo={handleReplyToFromReply} />
				{/each}
			</div>
		{/if}
	{/if}
	{#if showExpansion}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="expansion-mask" role="button" tabindex="0" onclick={handleExpansionClose} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpansionClose(e); } }}></div>
		<div class="expansion" role="button" tabindex="0" onclick={handleExpansionClose} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpansionClose(e); } }}>
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
