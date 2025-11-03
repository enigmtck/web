<script lang="ts">
	import Reply from '$lib/components/timeline/Reply.svelte';
	import Article from '$lib/components/timeline/Article.svelte';
	import Compose from '$lib/components/timeline/Compose.svelte';

	import { onDestroy, onMount, tick } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { appData, enigmatickWasm } from '../../stores';
	import { useMediaQuery } from 'svelte-breakpoints';
	//import init from 'wasm/enigmatick_wasm_bg.wasm?init';

	import type {
		UserProfile,
		UserProfileTerse,
		Note,
		StreamConnect,
		AnnounceParams,
		Attachment,
		Activity,
		Collection,
		Ephemeral,
		Instrument
	} from '../../common';
	import {
		insertEmojis,
		compare,
		sleep,
		DisplayNote,
		extractMaxMin,
		getWebFingerFromId,
		convertMastodonUrlToWebfinger,
		getFirstValue
	} from '../../common';

	import { goto } from '$app/navigation';
	import type { ComposeDispatch, TimelineDispatch } from '$lib/components/timeline/common';
	import Filters from '$lib/components/timeline/Filters.svelte';

	let composeComponent = $state<Compose | undefined>(undefined);
	let view = $state('');

	let wasm = $derived($enigmatickWasm);

	let streamUuid: string | null = null;
	let context: any;

	const isSmallScreen = useMediaQuery('(max-width: 1000px)');

	onMount(async () => {
		if (scrollable) {
			scrollable.addEventListener('scroll', handleInfiniteScroll);
		}

		if (username) {
			view = 'home';
		} else {
			view = 'global';
		}

		await loadMinimum();
	});

	const placeNote = async (displayNote: DisplayNote) => {
		console.debug(`Placing ${displayNote.note.id}`);
		
		if (!displayNote.note.inReplyTo && displayNote.note.id) {
			// If 'inReplyTo' is blank or no matching DisplayNote found, add it to the top level
			if (!notes.has(displayNote.note.id)) {
				notes = new Map(notes).set(displayNote.note.id, displayNote);
			}
			await updateDOM(true, 0);
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

		// If 'inReplyTo' exists, try to find the parent note
		if (displayNote.note.inReplyTo && findAndAddReply(notes)) {
			// Force reactivity by creating new Map reference
			notes = new Map(notes);
			await updateDOM(false);
			return;
		}

		await updateDOM(false);
	};

	const updateDOM = async (fixScroll: boolean, ticks?: number) => {
		try {
			let beforeScroll = scrollPosition;
			//console.log(`SCROLL TOP ${beforeScroll}`);

			notes = notes;

			if (fixScroll && ticks) {
				for (let t = 0; t < ticks; t++) {
					await tick();
				}
				//console.log(`SCROLLING TO ${beforeScroll}`);
				scrollable.scrollTo({ top: beforeScroll, left: 0, behavior: 'instant' });
			}
		} catch (e) {
			//console.debug('Error updating notes');
			console.error(e);
		}
	};

	const addNote = async (activity: Activity) => {
		console.debug(`Adding ${activity.object.id}`);
		console.debug(activity.object);

		if (activity.object.attributedTo) {
			console.debug(`Attributed to ${activity.object.ephemeral?.attributedTo}`);

			const actor = getFirstValue(activity.object.ephemeral?.attributedTo);

			if (actor) {
				const displayNote = new DisplayNote(actor, activity.object, activity);
				await placeNote(displayNote);
			}
		}
	};

	const loadMinimum = async () => {
		let topLevel = 0;

		notes.forEach((note) => {
			if (!note.note.inReplyTo) {
				topLevel += 1;
			}
		});

		if (topLevel < 10) {
			try {
				// if loadTimelineData returns 0, that means it's reached the end
				// of what is available and we should stop
				let results = await loadTimelineData();
				//console.debug('TIMELINE LENGTH: ' + results);
				if (results && results > 0) {
					await loadMinimum();
				}
			} catch (e) {
				console.error(e);
			}
		}
	};

	const loadTimelineData = async () => {
		const pageSize = 20;
		let attempts = 0;

		if (wasm && view && scrollable) {
			if (!cache) {
				//console.debug('INSTANTIATING CACHE');
				cache = new wasm.EnigmatickCache();
				//console.debug('Cache instantiated');
			}

			let x = await wasm.get_timeline(maxValue, undefined, pageSize, view, hashtags);

			//console.debug('X!');
			//console.debug(x);
			try {
				let collection: Collection = JSON.parse(String(x));
				//console.debug('RETRIEVED TIMELINE DATA');
				//console.debug(collection);

				if (collection.next) {
					const result = extractMaxMin(collection.next);

					if (result.type === 'max' && result.value) {
						maxValue = result.value;
					}
				}

				try {
					collection.orderedItems?.forEach((a: Activity) => {
						addNote(a);
					});
				} catch (e) {
					console.error(e);
				}

				return length;
			} catch (e) {
				console.error(e);
				//console.debug(x);
				// this will stop execution on a parsing error, but the alternative is an infinite loop in the wasm
				// module if the server becomes unavailable
				//throw e;

				// I'm overriding this for now because my proxy seems to be throwing random 502s (probably related
				// to network and NAT configuration) that I haven't taken time to diagnose
				while (attempts++ < 10) {
					await sleep(1000);
					await loadTimelineData();
					//console.debug('Retrying timeline');
				}
			}
		} else {
			//console.error('No wasm or view yet');
			await sleep(500);
			await loadTimelineData();
		}
	};

	beforeNavigate(async (navigation) => {
		//console.log(navigation);

		if (navigation.to) {
			if (navigation.to.route.id === null) {
				let url = navigation.to.url.href;

				// we want to catch the calls to external profiles so that we can offer actions on them; the
				// intention of this expression is to match Mastodon-isms like (with grouping notated)
				// ^https://(ser)(.endipito)(.us)/@justin$ or ^https://(infosec)(.exchange)/@jdt$
				const actor_url = /^https:\/\/(?:[a-zA-Z0-9\-]+)(?:\.[a-zA-Z0-9\-]+)+?\/@[a-zA-Z0-9_]+$/;
				const mastodon_tag_url =
					/^https:\/\/(?:[a-zA-Z0-9\-]+)(?:\.[a-zA-Z0-9\-]+)+?\/tags\/([a-zA-Z0-9\-_]+)$/;
				const friendica_tag_url =
					/^https:\/\/(?:[a-zA-Z0-9\-]+)(?:\.[a-zA-Z0-9\-]+)+?\/search\?tag=([a-zA-Z0-9\-_]+)$/;

				let matches;

				if (url.match(actor_url)) {
					let webfinger = convertMastodonUrlToWebfinger(url);

					if (webfinger) {
						//console.log(`WEBFINGER: ${webfinger}`);
						navigation.cancel();
						goto(`/${webfinger}`);
					}
				} else if (
					(matches = url.match(mastodon_tag_url)) ||
					(matches = url.match(friendica_tag_url))
				) {
					// Create new Set instance to force reactivity
					hashtags = new Set(hashtags).add(matches[1].toLowerCase());
					navigation.cancel();
					resetData();
				}
			}
		}

		//console.log(hashtags);
	});

	const handleView = async (event: Event) => {
		//console.log(event);
		if (event.target) {
			let selected = (<HTMLElement>event.target).dataset.view;
			if (selected) {
				Array.from(
					document
						.getElementsByTagName('header')[0]
						.getElementsByTagName('nav')[0]
						.getElementsByTagName('button')
				).forEach((x) => x.classList.remove('selected'));

				(<HTMLElement>event.target).classList.add('selected');

				view = selected;
				await resetData();
			}
		}
	};

	const clearNoteSelect = async () => {
		focusConversation = null;
		focusNote = null;
		composeComponent?.resetCompose();

		await revertScroll();

		infiniteScrollDisabled = false;
	};

	const revertScroll = async () => {
		await tick();
		await tick();
		await tick();
		scrollable.scrollTo({ top: yPosition, left: 0, behavior: 'instant' });
	};

	const scrollToTop = async (): Promise<number> => {
		let current: number = scrollable.scrollTop;

		//console.debug(`CURRENT: ${current}`);

		await tick();
		await tick();
		await tick();
		scrollable.scrollTo({ top: 0, left: 0, behavior: 'instant' });

		//console.debug('SCROLLED TO TOP');

		return current;
	};

	const handleInfiniteScroll = async () => {
		if (!loading && !infiniteScrollDisabled && !focusNote) {
			loading = true;

			// console.debug('SCROLL TOP: ' + scrollable.scrollTop);
			// console.debug('OFFSET HEIGHT: ' + scrollable.offsetHeight);
			// console.debug('SCROLL HEIGHT: ' + scrollable.scrollHeight + '\n\n');

			let results = 1;
			while (
				!infiniteScrollDisabled &&
				scrollable.scrollTop + scrollable.offsetHeight >= (scrollable.scrollHeight * 0.9) &&
				results > 0
			) {
				results = (await loadTimelineData()) || 0;
			}

			loading = false;
		}

		const scroll = document.getElementsByClassName('scroll')[0] as HTMLElement;
		if (scrollable.scrollTop < 50) {
			liveLoading = true;

			scroll.style.display = 'none';
		} else {
			liveLoading = false;
			scroll.style.display = 'revert';
		}
	};

	const cachedActor = async (id: string) => {
		if (id && wasm && cache) {
			try {
				//console.debug(`RETRIEVING ${id} FROM CACHE`);
				return await wasm.get_actor_cached(cache, id);
			} catch (e) {
				console.error(`Failed to retrieve actor: ${id}`);
				return null;
			}
		}

		return null;
	};

	const cachedNote = async (id: string): Promise<string | undefined> => {
		if (wasm && !apCache.has(id)) {
			apCache.set(id, wasm.get_note(id));
		}

		const cached = apCache.get(id);
		
		// Check if the cached value is a Promise that needs to be awaited
		if (cached && cached instanceof Promise) {
			return await cached;
		}
		
		return cached;
	};

	const senderFunction = async (
		replyToActor: UserProfile | UserProfileTerse | null,
		replyToNote: DisplayNote | null,
		content: string,
		attachments: Attachment[],
		mentions: Map<string, UserProfile>,
		hashtags: string[],
		directed: boolean
	): Promise<string | null | undefined> => {
		if (wasm) {
			let params = (await wasm.SendParams.new()).set_content(content);

			if (!directed) {
				params.set_public();
			}

			params.set_attachments(JSON.stringify(attachments));
			params.set_hashtags(hashtags);

			for (const [webfinger, actor] of mentions) {
				params.add_mention(
					webfinger,
					actor.id || '',
					actor.capabilities?.enigmatickEncryption || false
				);
			}

			if (replyToNote) {
				params.set_in_reply_to(String(replyToNote.note.id));
				params.set_conversation(String(replyToNote.note.conversation));
			}

			//console.log(params);
			return await wasm.send_note(params);
		} else {
			return null;
		}
	};

	const refresh = () => {
		//console.debug('Refreshing timeline');
	};

	const remove = () => {
		//console.debug('Removing note');
	};

	const handleHashtagAdd = (tag: string) => {
		// Create new Set instance to force reactivity
		const newHashtags = new Set(hashtags);
		newHashtags.add(tag);
		hashtags = newHashtags;
	};

	const handleHashtagRemove = (tag: string) => {
		// Create new Set instance to force reactivity
		const newHashtags = new Set(hashtags);
		newHashtags.delete(tag);
		hashtags = newHashtags;
	};

	const resetData = async () => {
		clearNoteSelect();
		noteQueue = [];
		notes = new Map<string, DisplayNote>();
		await scrollToTop();
		maxValue = undefined;
		minValue = undefined;

		const scroll = document.getElementsByClassName('scroll')[0] as HTMLElement;
		scroll.style.display = 'none';
		await loadMinimum();
	};

	const handleMinimizeContext = (event?: any) => {
		if (event) {
			event.preventDefault();
		}

		//console.debug('Toggling Filters');
		if (context.style.display === 'none') {
			context.style.display = 'flex';
		} else {
			context.style.display = 'none';
		}
	};

	let cache: any = null;

	let hashtags = $state(new Set<string>());

	// controls whether messages from EventSource are immediately displayed or queued
	let liveLoading = true;
	let infiniteScrollDisabled = false;

	// the queue used when the page is not scrolled to the top
	let noteQueue: Note[] = [];

	// HTML formatted notes to display in the Timeline
	//$: notes = new Array<DisplayNote>();
	// ap_id -> [published, note, replies, sender, in_reply_to, conversation]
	let notes = $state(new Map<string, DisplayNote>());
	// Derive array that reacts to Map changes
	// Access notes.size to ensure reactivity tracking, then convert to array
	let notesArray = $derived.by(() => {
		// Access the Map in a way that tracks mutations
		const size = notes.size;
		const values = Array.from(notes.values());
		return values;
	});

	// used very temporarily to control requests to the API for new data
	let loading = false;

	let maxValue: string | undefined = undefined;
	let minValue: string | undefined = undefined;

	// used to reduce calls to the API for Actor data
	let apCache = new Map<string, Promise<string | undefined> | string | undefined>();

	let username = $appData.username;

	let focusNote = $state<string | null>(null);
	let focusConversation = $state<string | null>(null);

	let yPosition: number = 0;
	let filterHandle: HTMLDivElement;

	let scrollable: HTMLDivElement;
	let scrollPosition = 0;

	let articleRefs: any[] = [];

	const updateScrollPosition = (event: UIEvent) => {
		if (!loading && !focusNote) {
			scrollPosition = scrollable.scrollTop;
		}
	};
</script>

<Compose
	{senderFunction}
	onPublish={(dispatch ) => addNote(dispatch.activity)}
	bind:this={composeComponent}
	direct={view === 'direct'}
/>

<main>
	<div class="content">
		<header>
			<nav>
				{#if username}
				<button class="selected" data-view="home" onclick={handleView} aria-label="Home view"
					><i class="fa-solid fa-house"></i></button
				>
					<button data-view="local" onclick={handleView} aria-label="Local view"><i class="fa-solid fa-hotel"></i></button>
					<button data-view="direct" onclick={handleView} aria-label="Direct messages view"><i class="fa-solid fa-at"></i></button>
				{/if}
				<button data-view="global" onclick={handleView} aria-label="Global view"><i class="fa-solid fa-globe"></i></button>
			</nav>

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="scroll" role="button" tabindex="0" onclick={scrollToTop} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToTop(); } }}>
				<i class="fa-solid fa-chevron-up"></i>
			</div>
		</header>

		<div class="scrollable" onscroll={updateScrollPosition} bind:this={scrollable}>
			<!-- Debug: notes.size={notes.size}, notesArray.length={notesArray.length} -->
			{#each notesArray as note, i}
				{#if note?.note && ((!focusNote && (!note.note.inReplyTo || note.note.ephemeral?.announces?.length)) || note.note.id == focusNote)}
					<Article
						bind:this={articleRefs[i]}
						parentArticle={articleRefs[i]}
						{remove}
						{note}
						onReplyTo={composeComponent?.handleReplyToMessage}
						{cachedNote}
					/>
				{/if}
			{/each}
		</div>

		{#if focusNote || focusConversation}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="back" role="button" tabindex="0" onclick={(e) => { e.preventDefault(); clearNoteSelect(); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearNoteSelect(); } }}>
				<i class="fa-solid fa-angles-left"></i>
			</div>
		{/if}
	</div>

	<div class="context">
		<div bind:this={context} style="display: {$isSmallScreen ? 'none' : 'flex'};">
			<h1>Filters</h1>
			<Filters {hashtags} {resetData} onHashtagAdd={handleHashtagAdd} onHashtagRemove={handleHashtagRemove} />
		</div>
		<div class="handle" bind:this={filterHandle}>
			<a href="#filters" onclick={handleMinimizeContext} aria-label="Toggle filters">&nbsp</a>
		</div>
	</div>
</main>

<style lang="scss">
	main {
		width: 100%;
		position: relative;
		overflow-y: hidden;
		grid-area: content;
		display: grid;
		grid-template:
			[row1-start] 'content context' auto [row2-end]
			/ auto 350px;

		@media screen and (max-width: 1000px) {
			min-width: unset;
			max-width: unset;
			width: 100%;
			padding: 0;
			grid-template:
				[row1-start] 'content' auto [row2-end]
				/ auto;
		}

		.content {
			width: 100%;
			overflow-y: hidden;

			header {
				z-index: 25;
				padding: 0;
				position: relative;
				width: 100%;
				height: 41px;
				background: #eee;
				color: darkred;
				text-align: center;
				font-family: 'Open Sans';
				font-size: 22px;
				font-weight: 600;
				grid-area: header;
				display: grid;
				grid-template-columns: auto auto auto;
				grid-template-areas: 'left center right';
				align-items: center;

				nav {
					grid-area: center;
					display: flex;
					flex-direction: row;
					align-items: center;
					margin: 0;
					width: 100%;

					button {
						display: inline-block;
						width: 100%;
						text-decoration: none;
						font-family: 'Open Sans';
						font-size: 14px;
						padding: 5px;
						margin: 0 5px;
						color: #222;
						background: none;
						border: 0;
						border-radius: 20px;
					}

					button.selected {
						background: #ddd !important;
					}

					button:hover {
						cursor: pointer;
					}

					button > i {
						padding: 0 5px;
						pointer-events: none;
					}
				}
			}

			div.scrollable {
				overflow-y: auto;
				height: calc(100% - 41px);
				scroll-behavior: smooth;
				padding: 0 10px;

				@media screen and (max-width: 700px) {
					height: calc(100% - 91px);
					padding: 0;
				}
			}

			.back {
				position: absolute;
				left: 25px;
				top: calc(50% - 80px);
				width: 34px;
				height: 160px;
				align-content: center;
				text-align: center;
				border-radius: 15px;
				font-size: 28px;
				color: white;
				opacity: 0.6;
				transition-duration: 1s;
				z-index: 25;
				background: maroon;
				padding: 8px 0 0 0;
			}

			.back:hover {
				opacity: 1;
				color: white;
				background: maroon;
				transition-duration: 1s;
				cursor: pointer;
			}

			.scroll {
				display: none;
				position: absolute;
				left: calc(50% - 80px);
				width: 160px;
				top: 50px;
				padding-top: 2px;
				opacity: 0.5;
				background: darkred;
				text-align: center;
				border-radius: 15px;
				font-size: 26px;
				color: white;
				border: 0;
				transition-duration: 1s;
				z-index: 40;

				i {
					pointer-events: none;
				}
			}

			.scroll:hover {
				opacity: 1;
				cursor: pointer;
				transition-duration: 1s;
			}
		}

		.context {
			width: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;
			padding: 20px;

			> div {
				position: relative;
				width: 100%;
				background: #fafafa;
				padding: 0 0 5px 0;
				margin: 0;
				border: 0;
				border-radius: 10px;
				display: flex;
				flex-direction: column;
				align-items: center;

				h1 {
					font-family: 'Open Sans';
					font-size: 14px;
					padding: 5px 10px;
					margin: 0;
					color: #777;
					background: #fafafa;
					width: 100%;
					border-radius: 10px 10px 0 0;
				}
			}

			.handle {
				display: none;
			}
		}

		@media screen and (max-width: 1000px) {
			.context {
				position: absolute;
				top: 41px;
				left: 0;
				width: 100%;
				padding: 0;
				z-index: 25;
				background: #eee;

				div {
					padding: 0;
					margin: 0;
					border-radius: 0;
					background: #eee;

					h1 {
						display: none;
					}
				}

				.handle {
					height: 5px;
					display: unset;

					a {
						width: 100%;
						height: 5px;
						display: inline-block;
						text-align: center;
						background: maroon;
						color: white;
					}
				}
			}
		}
	}

	:global(body.dark) {
		main {
			background: #000;
			header {
				background: #000;

				nav {
					button {
						color: #eee;
					}

					button.selected {
						background: #333 !important;
					}
				}
			}

			.context {
				div {
					background: #222;

					h1 {
						background: #222;
					}
				}

				@media screen and (max-width: 1000px) {
					div {
						background: #000;
					}
				}
			}
		}
	}
</style>
