<script lang="ts">
	import Reply from './components/Reply.svelte';
	import Article from './components/Article.svelte';
	import Compose from './components/Compose.svelte';

	import { onDestroy, onMount, tick, afterUpdate } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { appData, enigmatickWasm, wasmState } from '../../stores';
	//import { appData, wasmState } from '../../stores';
	import { useMediaQuery } from 'svelte-breakpoints';
	//import init from 'wasm/enigmatick_wasm_bg.wasm?init';

	import type {
		UserProfile,
		UserProfileTerse,
		Note,
		StreamConnect,
		Announce,
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
		convertMastodonUrlToWebfinger
	} from '../../common';

	import { goto } from '$app/navigation';
	import type { ComposeDispatch } from './components/common';
	import Filters from './components/Filters.svelte';

	let composeComponent: Compose;
	$: view = '';

	$: wasm = $enigmatickWasm;
	//let wasm: any = null;

	let streamUuid: string | null = null;
	let observer: IntersectionObserver | null = null;
	let retrievedConversations: Set<string> = new Set();
	let currentIds: Array<string> = new Array();
	let context: any;

	const isSmallScreen = useMediaQuery('(max-width: 1000px)');

	function onIntersection(entries: IntersectionObserverEntry[]) {
		for (let entry of entries) {
			if (entry.target) {
				let target = <HTMLElement>entry.target;
				if (entry.isIntersecting) {
					currentIds.push(target.id);

					if (target.dataset) {
						let dataset = <DOMStringMap>target.dataset;
						console.log(dataset.conversation);
						if (wasm && dataset.conversation) {
							let conversation = dataset.conversation;

							if (!retrievedConversations.has(conversation)) {
								retrievedConversations.add(conversation);
								wasm
									.get_conversation(encodeURIComponent(dataset.conversation), 50)
									.then((conversation: any) => {
										if (conversation) {
											let collection: Collection = JSON.parse(conversation);

											collection.orderedItems?.forEach((a: Activity) => {
												console.debug(a);
												if (a.object.inReplyTo) {
													addNote(a);
												}
											});

											placeOrphans();
										}

										console.debug('NOTES MAP');
										console.debug(notes);

										console.debug('ORPHANS MAP');
										console.debug(orphans);
									});
							}
						}
					}
				} else {
					let index = currentIds.indexOf(target.id);
					if (index !== -1) {
						currentIds.splice(index, 1);
					}
				}
			}
		}
	}

	function observeNote(note: any) {
		if (observer) {
			observer.observe(note);
		}
	}

	onMount(async () => {
		observer = new IntersectionObserver(onIntersection, {
			root: null, // default is the viewport
			threshold: 0.3 // percentage of target's visible area. Triggers "onIntersection"
		});

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

	function placeOrphans() {
		let orphans_copy = [...orphans];

		orphans_copy.forEach((orphan) => {
			orphans.delete(orphan[0]);
			placeNote(orphan[1]);
		});
	}

	async function placeNote(displayNote: DisplayNote) {
		if (!displayNote.note.inReplyTo && displayNote.note.id) {
			// If 'inReplyTo' is blank or no matching DisplayNote found, add it to the top level
			if (!notes.has(displayNote.note.id)) {
				notes.set(displayNote.note.id, displayNote);
			}
			await updateDOM(true, 0);
			return;
		}

		function findAndAddReply(map: Map<string, DisplayNote>): boolean {
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
		}

		// If 'inReplyTo' exists, try to find the parent note
		if (displayNote.note.inReplyTo && findAndAddReply(notes)) {
			await updateDOM(false);
			return;
		} else if (displayNote.note.id && displayNote.note.inReplyTo) {
			orphans.set(displayNote.note.id, displayNote);
		}

		await updateDOM(false);
	}

	const updateDOM = async (fixScroll: boolean, ticks?: number) => {
		try {
			let beforeScroll = scrollPosition;
			console.log(`SCROLL TOP ${beforeScroll}`);

			notes = notes;

			if (fixScroll && ticks) {
				for (let t = 0; t < ticks; t++) {
					await tick();
				}
				console.log(`SCROLLING TO ${beforeScroll}`);
				scrollable.scrollTo({ top: beforeScroll, left: 0, behavior: 'instant' });
			}
		} catch (e) {
			console.debug('Error updating notes');
			console.error(e);
		}
	};

	async function addNote(activity: Activity) {
		if (activity.object.attributedTo) {
			const actor = activity.object.ephemeral?.attributedTo?.at(0);

			if (actor) {
				const displayNote = new DisplayNote(actor, activity.object, activity);
				await placeNote(displayNote);
			}
		}
	}

	async function loadMinimum() {
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
				console.debug('TIMELINE LENGTH: ' + results);
				if (results && results > 0) {
					await loadMinimum();
				}
			} catch (e) {
				console.error(e);
			}
		}
	}

	async function loadTimelineData() {
		const pageSize = 20;
		let attempts = 0;

		if (wasm && view && scrollable) {
			if (!cache) {
				console.debug('INSTANTIATING CACHE');
				cache = new wasm.EnigmatickCache();
				console.debug('Cache instantiated');
			}

			let x = await wasm.get_timeline(maxValue, undefined, pageSize, view, hashtags);

			console.debug('X!');
			console.debug(x);
			try {
				let collection: Collection = JSON.parse(String(x));
				console.debug('RETRIEVED TIMELINE DATA');
				console.debug(collection);

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

				placeOrphans();

				return length;
			} catch (e) {
				console.error(e);
				console.debug(x);
				// this will stop execution on a parsing error, but the alternative is an infinite loop in the wasm
				// module if the server becomes unavailable
				//throw e;

				// I'm overriding this for now because my proxy seems to be throwing random 502s (probably related
				// to network and NAT configuration) that I haven't taken time to diagnose
				while (attempts++ < 10) {
					await sleep(1000);
					await loadTimelineData();
					console.debug('RETRYING TIMELINE');
				}
			}
		} else {
			console.error('NO WASM OR VIEW YET');
			await sleep(500);
			await loadTimelineData();
		}
	}

	beforeNavigate(async (navigation) => {
		console.log(navigation);

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
						console.log(`WEBFINGER: ${webfinger}`);
						navigation.cancel();
						goto(`/${webfinger}`);
					}
				} else if (
					(matches = url.match(mastodon_tag_url)) ||
					(matches = url.match(friendica_tag_url))
				) {
					hashtags.add(matches[1].toLowerCase());
					navigation.cancel();
					hashtags = hashtags;
					resetData();
				}
			}
		}

		console.log(hashtags);
	});

	async function handleView(event: Event) {
		console.log(event);
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
	}

	async function handleNoteSelect(message: CustomEvent<ComposeDispatch>) {
		console.debug('NOTE SELECT');
		console.debug(message);
		focusConversation = message.detail.replyToNote.conversation;
		focusNote = message.detail.replyToNote.id || null;
		console.debug(`setting focusNote to ${message.detail.replyToNote}`);

		yPosition = await scrollToTop();

		infiniteScrollDisabled = true;
	}

	async function clearNoteSelect() {
		focusConversation = null;
		focusNote = null;
		composeComponent.resetCompose();

		await revertScroll();

		infiniteScrollDisabled = false;
	}

	async function revertScroll() {
		await tick();
		await tick();
		await tick();
		scrollable.scrollTo({ top: yPosition, left: 0, behavior: 'instant' });
	}

	async function scrollToTop(): Promise<number> {
		let current: number = scrollable.scrollTop;

		console.debug(`CURRENT: ${current}`);

		await tick();
		await tick();
		await tick();
		scrollable.scrollTo({ top: 0, left: 0, behavior: 'instant' });

		console.debug('SCROLLED TO TOP');

		return current;
	}

	async function handleInfiniteScroll() {
		if (!loading && !infiniteScrollDisabled) {
			loading = true;

			let results = 1;
			while (
				!infiniteScrollDisabled &&
				scrollable.scrollTop + scrollable.offsetHeight >= scrollable.scrollHeight * 0.8 &&
				results > 0
			) {
				results = (await loadTimelineData()) || 0;
			}

			loading = false;
		}

		const scroll = document.getElementsByClassName('scroll')[0] as HTMLElement;
		if (scrollable.scrollTop < 50) {
			liveLoading = true;

			// let note;
			// while ((note = noteQueue.shift()) !== undefined) {
			// 	addNote(note);
			// }

			scroll.style.display = 'none';
		} else {
			liveLoading = false;
			scroll.style.display = 'revert';
		}
	}

	async function cachedActor(id: string) {
		if (id && wasm && cache) {
			try {
				console.debug(`RETRIEVING ${id} FROM CACHE`);
				return await wasm.get_actor_cached(cache, id);
			} catch (e) {
				console.error(`FAILED TO RETRIEVE: ${id}`);
				return null;
			}
		}

		return null;
	}

	async function cachedNote(id: string): Promise<string | undefined> {
		if (wasm && !apCache.has(id)) {
			apCache.set(id, await wasm.get_note(id));
		}

		return apCache.get(id);
	}

	async function senderFunction(
		replyToActor: UserProfile | UserProfileTerse | null,
		replyToNote: Note | null,
		content: string,
		attachments: Attachment[],
		mentions: Map<string, UserProfile>,
		hashtags: string[],
		directed: boolean
	): Promise<boolean> {
		if (wasm) {
			let params = (await wasm.SendParams.new()).set_content(content);

			if (!directed) {
				params.set_public();
			}

			params.set_attachments(JSON.stringify(attachments));
			params.set_hashtags(hashtags);

			for (const [webfinger, actor] of mentions) {
				params.add_mention(webfinger, actor.id || "", actor.capabilities?.enigmatickEncryption || false);
			}

			if (replyToNote) {
				params.set_in_reply_to(String(replyToNote.id));
				params.set_conversation(String(replyToNote.conversation));
			}

			console.log(params);
			return await wasm.send_note(params);
		} else {
			return false;
		}
	}

	function refresh() {
		console.debug('REFRESH');
	}

	function remove() {
		console.debug('REMOVE');
	}

	async function resetData() {
		clearNoteSelect();
		noteQueue = [];
		orphans = new Map<string, DisplayNote>();
		notes = new Map<string, DisplayNote>();
		retrievedConversations = new Set();
		await scrollToTop();
		maxValue = undefined;
		minValue = undefined;

		const scroll = document.getElementsByClassName('scroll')[0] as HTMLElement;
		scroll.style.display = 'none';
		await loadMinimum();
	}

	const handleMinimizeContext = (event?: any) => {
		if (event) {
			event.preventDefault();
		}

		console.debug('Toggling Filters');
		if (context.style.display === 'none') {
			context.style.display = 'flex';
		} else {
			context.style.display = 'none';
		}
	};

	let cache: any = null;

	let hashtags: Set<string> = new Set();
	//let hashtags: string[] = [];

	// controls whether messages from EventSource are immediately displayed or queued
	let liveLoading = true;
	let infiniteScrollDisabled = false;

	// the queue used when the page is not scrolled to the top
	let noteQueue: Note[] = [];

	// HTML formatted notes to display in the Timeline
	//$: notes = new Array<DisplayNote>();
	// ap_id -> [published, note, replies, sender, in_reply_to, conversation]
	$: notes = new Map<string, DisplayNote>();

	//let orphans: Map<string, DisplayNote> = new Map<string, DisplayNote>();
	let orphans: Map<string, DisplayNote> = new Map<string, DisplayNote>();

	// used very temporarily to control requests to the API for new data
	let loading = false;

	let maxValue: string | undefined = undefined;
	let minValue: string | undefined = undefined;

	// used to reduce calls to the API for Actor data
	let apCache = new Map<string, string | undefined>();

	let username = $appData.username;

	let focusNote: string | null = null;
	let focusConversation: string | null = null;

	let yPosition: number = 0;
	let filterHandle: HTMLDivElement;

	// $: if (wasm) {
	// 	loadMinimum();
	// }

	let scrollable: HTMLDivElement;
	let scrollPosition = 0;

	const updateScrollPosition = (event: UIEvent) => {
		if (!loading) {
			scrollPosition = scrollable.scrollTop;
		}
	};
</script>

<Compose {senderFunction} bind:this={composeComponent} direct={view === 'direct'} />

<main>
	<div class="content">
		<header>
			<nav>
				{#if username}
					<button class="selected" data-view="home" on:click={handleView}
						><i class="fa-solid fa-house" /></button
					>
					<button data-view="local" on:click={handleView}><i class="fa-solid fa-city" /></button>
					<button data-view="direct" on:click={handleView}
						><i class="fa-solid fa-envelope" /></button
					>
				{/if}
				<button data-view="global" on:click={handleView}><i class="fa-solid fa-globe" /></button>
			</nav>

			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="scroll" on:click={scrollToTop}>
				<i class="fa-solid fa-chevron-up" />
			</div>
		</header>

		<div class="scrollable" on:scroll={updateScrollPosition} bind:this={scrollable}>
			{#each Array.from(notes.values()) as note}
				{#if note.note && ((!focusNote && (!note.note.inReplyTo || note.note.ephemeral?.announces?.length)) || note.note.id == focusNote)}
					<Article
						{remove}
						{refresh}
						{note}
						{username}
						on:replyTo={composeComponent.handleReplyToMessage}
						on:noteSelect={handleNoteSelect}
						renderAction={observeNote}
						{cachedNote}
					/>

					{#if note.note.id == focusNote && note.replies?.size}
						<div class="replies">
							{#each Array.from(note.replies.values()).sort(compare).reverse() as reply}
								<Reply
									note={reply}
									{username}
									on:replyTo={composeComponent.handleReplyToMessage}
									on:noteSelect={handleNoteSelect}
								/>
							{/each}
						</div>
					{/if}
				{/if}
			{/each}
		</div>

		{#if focusNote || focusConversation}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="back" on:click|preventDefault={clearNoteSelect}>
				<i class="fa-solid fa-angles-left" />
			</div>
		{/if}
	</div>

	<div class="context">
		<div bind:this={context} style="display: {$isSmallScreen ? 'none' : 'flex'};">
			<h1>Filters</h1>
			<Filters {hashtags} {resetData} />
		</div>
		<div class="handle" bind:this={filterHandle}>
			<a href="#filters" on:click={handleMinimizeContext}>&nbsp;</a>
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
		min-width: 400px;
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

				.replies {
					padding-bottom: 60px;
					display: flex;
					flex-direction: column;
					align-items: center;
				}

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

			div {
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
				z-index: 30;
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

				:global(div.filters) {
					background: #eee;
				}

				:global(div.filters > div) {
					background: #eee;
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

					:global(div.filters) {
						background: #222;
					}
				}

				@media screen and (max-width: 1000px) {
					div {
						background: #000;

						:global(div.filters) {
							background: #000;
						}

						:global(div.filters > div) {
							background: #000;
						}
					}
				}
			}
		}
	}
</style>
