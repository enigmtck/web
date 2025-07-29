<script lang="ts">
	export { handleReplyToMessage, openAside, resetCompose };
	import showdown from 'showdown';
	const { Converter } = showdown;
	import showdownHighlight from 'showdown-highlight';
	import { appData, enigmatickWasm } from '../../../stores';
	import {
		cachedContent,
		DisplayNote,
		insertEmojis,
		removeTags,
		type Activity,
		type Attachment,
		type Note,
		type UserProfile,
		type UserProfileTerse
	} from '../../../common';
	import type { ComposeDispatch, TimelineDispatch } from './common';
	import Reply from './Reply.svelte';
	import { tick } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	const publishDispatch = createEventDispatcher<{ publish: TimelineDispatch }>();

	$: wasm = $enigmatickWasm;

	// Exporting the definition of this function is to allow Compose to be used in
	// different contexts, like for both Notes and EncryptedNotes. The implementation
	// of the sending function is left up to the container component.
	export let senderFunction: (
		replyToActor: UserProfile | UserProfileTerse | null,
		replyToNote: DisplayNote | null,
		content: string,
		attachments: Attachment[],
		mentions: Map<string, UserProfile>,
		tags: string[],
		directed: boolean
	) => Promise<string | null | undefined>;

	export let direct: boolean;

	let parentArticle: any = null;

	async function handleReplyToMessage(message: CustomEvent<ComposeDispatch>) {
		console.log('IN COMPOSE');
		console.log(message);

		// Use parentArticle directly from the event detail
		parentArticle = message.detail.parentArticle;

		replyToActor = message.detail.replyToActor;
		replyToNote = message.detail.replyToNote;

		if (replyToNote.note.type == 'EncryptedNote') {
			direct = true;
		} else if (replyToNote.isPublic()) {
			direct = false;
		}

		if (message.detail.openAside) {
			openAside();
		}

		let webfinger = await wasm?.get_webfinger_from_id(replyToActor.id as string);
		markdownNote = `${webfinger} `;
		htmlNote = convertToHtml(markdownNote);

		await tick();

		console.debug('Compose parentArticle');
		console.debug(parentArticle);
	}

	function openAside() {
		const dialog = document.getElementsByTagName('dialog')[0];
		dialog.showModal();

		const mask = document.getElementsByClassName('mask')[0];
		mask.classList.remove('closed');
	}

	function closeAside() {
		resetCompose();
		const dialog = document.getElementsByTagName('dialog')[0];
		dialog.close();

		const mask = document.getElementsByClassName('mask')[0];
		mask.classList.add('closed');
	}

	function handleComposeSubmit(event: any) {
		console.log(event);
	}

	function convertToHtml(data: string) {
		let converter = new Converter({
			extensions: [
				showdownHighlight({
					pre: true,
					auto_detection: true
				})
			]
		});
		converter.setFlavor('vanilla');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeHtml(data);
	}

	function captureChanges() {
		if (composeDiv) {
			markdownNote = composeDiv.innerText;
			htmlNote = convertToHtml(markdownNote).replace('\n', '');
		}
	}

	async function handlePreview() {
		captureChanges();

		preview = !preview;

		await tick();
	}

	function resetCompose() {
		cancelReplyTo();
		preview = false;
		showDrawerContent = false;
		activeTab = 'attachments';
		markdownNote = '';
		htmlNote = '';
		mentions.clear();
		hashtags.clear();
	}

	function toggleDrawerContent() {
		showDrawerContent = !showDrawerContent;
	}

	function switchTab(tab: string) {
		activeTab = tab;
	}

	function cancelReplyTo() {
		replyToNote = null;
		replyToActor = null;
	}

	async function handlePublish() {
		captureChanges();

		let noteText = linkMentions(htmlNote);
		noteText = linkHashtags(noteText);

		senderFunction(
			replyToActor,
			replyToNote,
			noteText,
			Array.from(attachments.values()),
			new Map(
				Array.from(mentions.entries())
					.filter(([_, value]) => value !== null && value.id !== undefined)
					.map(([key, value]) => [key, value as UserProfile])
			),
			Array.from(hashtags),
			direct
		).then(async (x: any) => {
			if (x) {
				resetCompose();
				closeAside();

				let activity: Activity = JSON.parse(x);

				publishDispatch('publish', {
					activity
				});

				console.log(activity);
				console.log('send successful');

				console.log('parentArticle in senderFunction');
				console.log(parentArticle);
				// After successful publish, reload replies on parentArticle
				if (parentArticle && typeof parentArticle.loadReplies === 'function') {
					await parentArticle.loadReplies();
				}
			} else {
				console.log('send unsuccessful');
			}
		});
	}

	const onImageSelected = (e: Event) => {
		let target = e.target as HTMLInputElement;
		if (target.files !== null) {
			let image = target.files[0];
			let extension = String(image.name.match(/\.[0-9a-z]+$/i)).slice(1);
			let reader = new FileReader();
			reader.readAsArrayBuffer(image);
			reader.onload = (e: ProgressEvent<FileReader>) => {
				if (e.target !== null) {
					imageBuffer = e.target.result !== null ? e.target.result : null;
					let bytes = new Uint8Array(imageBuffer as ArrayBuffer);

					wasm?.upload_image(bytes, (imageBuffer as ArrayBuffer).byteLength).then((x) => {
						console.log('IMAGE UPLOADED');
						if (x) {
							let attachment: Attachment = JSON.parse(x);
							if (attachment.url) {
								attachments.set(attachment.url, attachment);
								attachments = attachments;
								console.debug(attachments);
							}
						}
					});
				}
			};
		}
	};

	const removeAttachment = (event: Event) => {
		if (event.target && event.target instanceof HTMLElement) {
			if (event.target.dataset.url) {
				const url: string = event.target.dataset.url;
				attachments.delete(url);
				attachments = attachments;
			}
		}
	};

	const annotateHashtags = (text: string): string => {
		const hashtagRegex = /#\w+/g;

		return text.replace(hashtagRegex, (match) => {
			hashtags.add(match);
			return `<span class="hashtag transient">${match}</span>`;
		});
	};

	const linkHashtags = (text: string): string => {
		const hashtagRegex = /#\w+/g;
		const matches = text.matchAll(hashtagRegex);
		const serverUrl = wasm?.get_state().get_server_url();

		for (const match of matches) {
			const fullMatch = match[0];
			const url = `${serverUrl}/tags/${fullMatch.replace('#', '')}`;

			if (hashtags.has(fullMatch)) {
				text = text.replaceAll(fullMatch, `<a href="${url}">${fullMatch}</a>`);
			}
		}

		return text;
	};

	const linkMentions = (text: string): string => {
		const mentionRegex = /@(\w+)@([\w-]+\.[\w-]+(?:\.[\w-]+)*)/g;
		const matches = text.matchAll(mentionRegex);

		for (const match of matches) {
			const fullMatch = match[0];
			let actor = mentions.get(fullMatch);
			if (actor) {
				text = text.replaceAll(
					fullMatch,
					`<span class="h-card"><a href="${actor.url}" class="u-url mention" rel="noopener noreferrer">@${actor.preferredUsername}</a></span>`
				);
			}
		}

		return text;
	};

	const annotateMentions = (text: string): Promise<string> => {
		const mentionRegex = /@(\w+)@([\w-]+\.[\w-]+(?:\.[\w-]+)*)/g;

		return new Promise(async (resolve, reject) => {
			try {
				const matches = text.matchAll(mentionRegex);
				for (const match of matches) {
					const fullMatch = match[0]; // The complete @user@domain match
					if (mentions.get(fullMatch) === undefined) {
						try {
							let actor: UserProfile = JSON.parse(
								await wasm?.get_actor_from_webfinger_promise(fullMatch)
							);
							mentions.set(fullMatch, actor);
						} catch (e) {
							console.error('Failed to retrieve actor');
							mentions.set(fullMatch, null);
							continue;
						}
					}
				}

				const result = text.replace(mentionRegex, (match, username, domain) => {
					let profile = mentions.get(match);
					let lock = '';

					if (profile?.capabilities?.enigmatickEncryption) {
						lock = '<i class="fa-solid fa-lock transient"></i>';
					}

					if (profile) {
						return `<span contenteditable="false" class="mention transient">${lock}${match}</span>`;
					} else {
						return match;
					}
				});

				resolve(result);
			} catch (error) {
				reject(error);
			}
		});
	};

	function getTextBeforeCursor(element: HTMLElement): string {
		let textBeforeCursor = '';

		if (window.getSelection) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const preCaretRange = range.cloneRange();
				preCaretRange.selectNodeContents(element);
				preCaretRange.setEnd(range.startContainer, range.startOffset);
				textBeforeCursor = preCaretRange.toString();
			}
		}

		// Split by whitespace and get the last non-empty word
		const words = textBeforeCursor.trim().split(/\s+/);
		return words[words.length - 1] || '';
	}

	const mentionRegex = /@(\w+)@([\w-]+\.[\w-]+(?:\.[\w-]+)*)/;
	const hashtagRegex = /#\w+/;

	let detectionTimeout: ReturnType<typeof setTimeout> | null = null;
	let resolvedMentions = new Map<string, UserProfile | null>(); // Cache for already resolved mentions

	const detectTagsAndMentions = async (event: Event) => {
		const text = composeDiv?.innerText || '';
		
		// Immediately detect hashtags (no network calls needed)
		hashtags.clear();
		const hashtagMatches = text.matchAll(/#\w+/g);
		for (const match of hashtagMatches) {
			hashtags.add(match[0]);
		}
		// Force reactivity
		hashtags = hashtags;
		
		// Clear existing timeout to debounce mentions (which need network calls)
		if (detectionTimeout) {
			clearTimeout(detectionTimeout);
		}

		// Debounce the mention detection to only run after user stops typing
		detectionTimeout = setTimeout(async () => {
			const text = composeDiv?.innerText || '';
			console.log('Detecting mentions in:', text);
			
			// Clear existing mentions collection
			mentions.clear();
			
			// Detect mentions - only check new ones
			const mentionMatches = text.matchAll(/@(\w+)@([\w-]+\.[\w-]+(?:\.[\w-]+)*)/g);
			for (const match of mentionMatches) {
				const fullMatch = match[0];
				console.log('Found mention:', fullMatch);
				
				// Only make network request if we haven't resolved this mention before
				if (!resolvedMentions.has(fullMatch)) {
					try {
						const actorData = await wasm?.get_actor_from_webfinger_promise(fullMatch);
						if (actorData) {
							const actor: UserProfile = JSON.parse(actorData);
							mentions.set(fullMatch, actor);
							resolvedMentions.set(fullMatch, actor); // Cache the successful resolution
						} else {
							mentions.set(fullMatch, null);
							resolvedMentions.set(fullMatch, null); // Cache the failed resolution too
						}
					} catch (e) {
						console.error('Failed to retrieve actor for', fullMatch);
						mentions.set(fullMatch, null);
						resolvedMentions.set(fullMatch, null); // Cache the failed resolution
					}
				} else {
					// If we've already resolved this mention, restore from cache
					const cachedActor = resolvedMentions.get(fullMatch);
					mentions.set(fullMatch, cachedActor || null);
				}
			}
			
			console.log('Final hashtags:', Array.from(hashtags));
			console.log('Final mentions:', Array.from(mentions.keys()));
			
			// Force reactivity
			mentions = mentions;
		}, 500); // Wait 500ms after user stops typing
	};



	$: markdownNote = '';
	$: htmlNote = '';
	let preview = false;
	let showDrawerContent = false;
	let activeTab = 'attachments'; // 'attachments' or 'tags'

	let webfingerRecipient: string | null = null;
	let replyToActor: UserProfile | UserProfileTerse | null = null;
	let replyToNote: DisplayNote | null = null;

	let imageBuffer: string | ArrayBuffer | null;
	let imageFileInput: HTMLInputElement;

	let attachments: Map<String, Attachment> = new Map();
	let mentions: Map<string, UserProfile | null> = new Map();
	let hashtags: Set<string> = new Set();
	
	// Create stable arrays for rendering
	$: mentionsArray = Array.from(mentions.entries());
	$: hashtagsArray = Array.from(hashtags);
	let composeDiv: HTMLDivElement;

	let privacyOpen = false;
	$: username = $appData.username;
</script>

<div class="mask closed" />
<dialog>
	{#if username}
		<div class={direct && !replyToNote ? 'direct' : ''}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<i class="fa-solid fa-xmark" on:click={closeAside} />

			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="compose-container">
				{#if replyToNote && replyToActor}
					<div class="reply">
						<div class="actor">
							<div>
								<img src={cachedContent(wasm, String(replyToActor.icon?.url))} alt="Avatar" />
							</div>
							<span>
								{#if replyToActor && replyToActor.name}
									{@html insertEmojis(wasm, replyToActor.name, replyToActor)}
								{:else}
									{replyToActor?.preferredUsername}
								{/if}
							</span>
						</div>
						<span>{removeTags(replyToNote.note.content)}</span>
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<i class="fa-solid fa-xmark" on:click|preventDefault={cancelReplyTo} />
					</div>
				{/if}
				<div
					class="entry"
					bind:this={composeDiv}
					contenteditable="true"
					on:input={detectTagsAndMentions}
					bind:innerText={markdownNote}
				/>

				<div class="drawer">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div class="pull{showDrawerContent ? ' open' : ''}" on:click={toggleDrawerContent}>
						<i class="fa-solid fa-caret-up" />
					</div>

									<div class="drawer-content{showDrawerContent ? ' open' : ''}">
							<div class="tabs">
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<span
									class={activeTab === 'attachments' ? 'selected' : ''}
									on:click={() => switchTab('attachments')}
								>
									Attachments
								</span>
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<span
									class={activeTab === 'tags' ? 'selected' : ''}
									on:click={() => switchTab('tags')}
								>
									Tags
								</span>
							</div>
							{#if activeTab === 'attachments'}
								<div class="attachments">
									{#if Array.from(attachments.values()).length > 0}
										{#each Array.from(attachments.values()) as attachment}
											<!-- svelte-ignore a11y-missing-attribute -->
											<div>
												<img
													src={attachment.url}
													width={attachment.width}
													height={attachment.height}
												/>
												<!-- svelte-ignore a11y-click-events-have-key-events -->
												<!-- svelte-ignore a11y-no-static-element-interactions -->
												<i
													class="fa-solid fa-xmark"
													data-url={attachment.url}
													on:click|preventDefault={removeAttachment}
												/>
											</div>
										{/each}
									{:else}
										<p class="no-attachments">No attachments added yet.</p>
									{/if}
								</div>
							{:else if activeTab === 'tags'}
								<div class="tags">
									{#if hashtagsArray.length > 0 || mentionsArray.length > 0}
										{#if hashtagsArray.length > 0}
											<div class="hashtags-section">
												<h4>Hashtags</h4>
												<div>
													{#each hashtagsArray as hashtag (hashtag)}
														<span class="hashtag-item">{hashtag}</span>
													{/each}
												</div>
											</div>
										{/if}
										
										{#if mentionsArray.length > 0}
											<div class="mentions-section">
												<h4>Mentions</h4>
												<div>
													{#each mentionsArray as [mention, actor] (mention)}
														<div class="mention-item">
															{#if actor}
																<span class="mention-text">{mention}</span>
																{#if actor.capabilities?.enigmatickEncryption}
																	<i class="fa-solid fa-lock" title="Supports encryption"></i>
																{/if}
															{:else}
																<span class="mention-text error">{mention}</span>
																<i class="fa-solid fa-exclamation-triangle" title="User not found"></i>
															{/if}
														</div>
													{/each}
												</div>
											</div>
										{/if}
									{:else}
										<p class="no-tags">No hashtags or mentions detected yet.</p>
									{/if}
								</div>
							{/if}
						</div>
				</div>
			</div>

			<form method="POST" on:submit|preventDefault={handleComposeSubmit}>
				<div>
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i
						class="fa-solid fa-paperclip"
						on:keyup={() => {
							imageFileInput.click();
						}}
						on:click={() => {
							imageFileInput.click();
						}}
					/>
					<input
						style="display:none"
						type="file"
						accept=".jpg, .jpeg, .png"
						on:change={(e) => onImageSelected(e)}
						bind:this={imageFileInput}
					/>
				</div>
				{#if preview}
					<div>
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<i class="fa-solid fa-pen-nib" on:click|preventDefault={handlePreview} />
					</div>
				{:else}
					<div>
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<i class="fa-solid fa-eye" on:click|preventDefault={handlePreview} />
					</div>
				{/if}
				<div>
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-regular fa-paper-plane" on:click|preventDefault={handlePublish} />
				</div>

				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div
					class={privacyOpen ? 'privacy' : ''}
					on:click={() => {
						privacyOpen = !privacyOpen;
					}}
				>
					{#if direct}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<i class="fa-solid fa-at" />
					{:else}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<i class="fa-solid fa-earth-americas" />
					{/if}
					<div>
						<ul>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
							<li
								on:click={() => {
									direct = true;
								}}
							>
								<i class="fa-solid fa-at" />
								<div>
									<h1>Direct</h1>
									<span
										>This note will be visible to mentioned people only. If possible (i.e., if to a
										single recipient who has Enigmatick encryption capabilities), the message will
										be end-to-end encrypted.</span
									>
								</div>
							</li>

							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
							<li
								on:click={() => {
									direct = false;
								}}
							>
								<i class="fa-solid fa-earth-americas" />
								<div>
									<h1>Public</h1>
									<span>This note will be visible to all viewers.</span>
								</div>
							</li>
						</ul>
					</div>
				</div>
			</form>
		</div>
	{/if}
</dialog>

{#if username}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="compose" on:click={openAside}>
		<i class="fa-solid fa-pencil" />
	</div>
{/if}

<style lang="scss">
	.mask {
		background: #999;
		opacity: 0.9;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		z-index: 26;
		pointer-events: all;
	}

	.closed {
		display: none;
	}

	dialog {
		margin: 0;
		position: fixed;
		min-height: 70dvh;
		min-width: 60dvw;
		max-height: 100%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 30;
		text-align: unset;
		padding: 0;
		border: 0;
		border-radius: 10px;
		overflow: visible;

		i.fa-xmark {
			position: absolute;
			right: 5px;
			top: 5px;
			cursor: pointer;
		}

		> div {
			position: relative;
			display: flex;
			flex-direction: column;
			height: 100%;
			margin: 0;
			padding: 25px 10px 0 10px;
			border-radius: 10px;
			background: #ddd;

			> span {
				display: inline-block;
				background: #efefef;
				border: 1px solid #ccc;
				padding: 4px;
				margin: 5px 0;
				font-family: 'Open Sans';

				position: fixed;
				top: 5px;
				left: 10px;
				z-index: 30;
				opacity: 0.9;
			}

			> i.fa-lock {
				position: absolute;
				left: 10px;
				top: 5px;
				font-size: 14px;
				pointer-events: none;
				color: red;
			}

			label {
				color: #777;
				font-family: 'Open Sans';
				font-size: 14px;
				font-weight: bold;
			}

			input[type='text'] {
				background: white;
				border-radius: 0;
				padding: 10px;
				margin: 0 0 5px 0;
				border: 0;
			}

			> div {
				position: relative;
				display: flex;
				flex-direction: column;
				text-align: left;
				width: 100%;
				margin: 0;
				background: white;
				min-height: calc(70dvh - 70px);
				max-height: 80vh;
				border: 1px solid #eee;
				font-family: 'Open Sans';
				border-radius: 0;
				outline: 1px solid #aaa;

				> div.reply {
					width: calc(100% - 10px);
					padding: 5px;
					margin: 5px;
					border-left: 5px solid darkred;
					overflow: hidden;

					> div.actor {
						display: flex;
						flex-direction: row;
						white-space: nowrap;
						overflow: hidden;

						> div {
							height: 40px;
							img {
								height: 100%;
								width: auto;
								object-fit: cover;
								clip-path: inset(0 0 0 0 round 20%);
							}
						}

						span {
							align-content: center;
							padding-left: 10px;
						}
					}

					> span {
						display: inline-block;
						width: 100%;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
						padding-top: 10px;
					}

					i {
						color: white;
					}

					i:hover {
						color: red;
					}
				}

				> div.entry {
					flex-grow: 2;
					height: calc(100% - 20px);
					width: 100%;
					padding: 10px;
					bottom: 0;
					word-wrap: break-word;
					white-space: pre-wrap;
					overflow: scroll;
					scrollbar-width: thin;

					:global(> span) {
						display: inline-flex;
						align-items: center;
					}

					:global(> span.mention) {
						background: darkred;
						margin: 1px;
						color: white;
						border-radius: 10px;
						padding: 2px 8px;

						:global(> i) {
							padding: 0 5px 0 0;
							color: goldenrod;
						}
					}

					:global(> span.hashtag) {
						margin: 1px;
						color: darkgoldenrod;
						font-weight: 600;
					}
				}
			}

			div:has(div:focus, input[type='text']:focus) {
				outline: 1px solid darkgoldenrod;
			}

			div:focus,
			input[type='text']:focus {
				outline: 0;
			}

			::-webkit-scrollbar {
				background-color: #333;
			}

			::-webkit-scrollbar-track {
				background-color: #333;
			}

			::-webkit-scrollbar-thumb {
				border: 3px solid #333;
			}

			::-webkit-scrollbar-corner {
				background-color: #333;
			}

			section {
				display: block;
				width: 100%;
				display: flex;
				flex-direction: row;
				flex-wrap: wrap;
			}

			form {
				display: flex;
				justify-content: space-evenly;
				align-items: center;

				> div {
					position: relative;
					padding: 0;
					margin: 5px;
					width: unset;
					height: unset;
					background: unset;
					border: unset;
					border-radius: 5px;

					i {
						font-size: 24px;
						padding: 10px;
					}

					> div {
						display: none;
						position: absolute;
						top: 47px;
						left: calc(-200px + 50%);
						width: 400px;
						background: #fafafa;
						padding: 5px;
						border-radius: 5px;

						ul {
							list-style: none;
							padding: 0;
							margin: 0;
							width: 100%;
							background: li {
								padding: 0;
								margin: 0;
								width: 100%;
							}

							li {
								display: flex;
								flex-direction: row;
								padding: 5px;
								align-items: top;
								border-radius: 5px;

								h1 {
									margin: 0;
									font-family: 'Open Sans';
									font-size: 16px;
								}

								span {
									font-family: 'Open Sans';
									font-size: 14px;
								}

								i {
									font-size: 20px;
								}
							}

							li:hover {
								background: #dfdfdf;

								h1 {
									color: darkred;
								}

								i {
									color: darkred;
								}
							}
						}
					}
				}

				> div.privacy {
					background: #efefef;
					outline: 1px solid #aaa;

					> div {
						display: unset;
						transform: translateY(calc(-100% - 50px));
					}
				}

				> div:hover {
					cursor: pointer;
					outline: 1px solid #aaa;
					background: #efefef;
				}
			}
		}

		.compose-container {
			.drawer {
				position: absolute;
				bottom: 0;
				width: 100%;
				display: block;
				text-align: center;
				max-height: 100%;
				overflow-x: scroll;

				.pull {
					padding: 0;
					margin: 0;
					height: 18px;
					line-height: 18px;
					display: flex;
					align-items: center;
					justify-content: center;
					width: 100%;

					i {
						color: white;
						font-size: 18px;
						cursor: pointer;
						line-height: 1;
						text-align: center;
						display: flex;
						align-items: center;
						justify-content: center;
						height: 100%;
						padding: 0px 10px;
						transition: transform 0.2s ease;

						&:hover {
							background: red;
						}
					}

					&.open i {
						transform: rotate(180deg);
					}
				}

				.drawer-content {
					display: block;
					transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
					max-height: 0;
					opacity: 0;
					overflow: hidden;

					&.open {
						max-height: 300px;
						opacity: 1;
					}

					.tabs {
						width: 100%;
						padding: 0;
						margin: 2px 0 0 0;
						display: flex;
						flex-direction: row;
						justify-content: space-evenly;

						span {
							cursor: pointer;
							font-size: 12px;
							padding: 5px;
							width: 50%;
							border: 0;
							background: #fff;
							color: #777;
							font-weight: 600;

							&:hover {
								background: #eee;
							}

							&.selected {
								background: #fafafa;
								border-top: 1px solid #ddd;
							}

							&:first-child {
								border-bottom: 1px solid #ddd;
								border-top-right-radius: 10px;
							}

							&:first-child.selected {
								border-right: 1px solid #ddd;
								border-bottom: 0;
							}

							&:last-child {
								border-bottom: 1px solid #ddd;
								border-top-left-radius: 10px;
							}

							&:last-child.selected {
								border-left: 1px solid #ddd;
								border-bottom: 0;
							}
						}
					}

					.attachments,
					.tags {
						background: #fafafa;
						width: 100%;
						height: 100%;
						min-height: 50px;
						padding: 10px;
						overflow-y: auto;
					}

					.tags {
						.hashtags-section,
						.mentions-section {
							margin-bottom: 15px;

							h4 {
								margin: 0 0 8px 0;
								font-size: 12px;
								color: #666;
								font-weight: 600;
							}

							// Container for mention items
							> div {
								display: flex;
								flex-wrap: wrap;
								gap: 4px;
								justify-content: center;
							}
						}

						.hashtag-item {
							display: inline-block;
							background: #f0f0f0;
							color: #333;
							padding: 4px 8px;
							border-radius: 12px;
							font-size: 12px;
							font-weight: 600;
							margin: 2px;
						}

						.mention-item {
							display: inline-flex;
							align-items: center;
							background: #f0f0f0;
							padding: 4px 8px;
							border-radius: 12px;
							font-size: 12px;
							margin: 4px 6px 4px 0;

							.mention-text {
								color: #333;
								font-weight: 600;
								margin-right: 4px;

								&.error {
									color: #d32f2f;
								}
							}

							i {
								font-size: 10px;
								margin-left: 4px;
							}

							i.fa-lock {
								color: #4caf50;
							}

							i.fa-exclamation-triangle {
								color: #ff9800;
							}
						}

						.no-tags {
							color: #777;
							font-style: italic;
							text-align: center;
							margin: 20px 0;
						}
					}

					.attachments {
						display: flex;
						flex-direction: row;
						flex-wrap: nowrap;
						justify-content: space-evenly;
						align-items: center;
						width: 100%;
						height: 100%;
						overflow: scroll;

						div {
							display: block;
							position: relative;
							border-radius: 5px;
							padding: 0;
							margin: 5px;
							border: 0;
							min-height: unset;
							width: 80px;
							height: 80px;
							min-width: 80px;
							overflow: hidden;

							img {
								width: 100%;
								height: 100%;
								object-fit: cover;
								object-position: center;
								opacity: 0.8;
							}

							i {
								padding: 3px;
								background: #ddd;
								color: #777;
								opacity: 0.5;

								&:hover {
									background: #ccc;
									color: #555;
								}
							}
						}

						.no-attachments {
							color: #777;
							font-style: italic;
							text-align: center;
							margin: 20px 0;
						}
					}
				}
			}
		}

		@media screen and (max-width: 600px) {
			top: 0;
			left: 0;
			width: 100vw;
			max-width: unset;
			max-height: unset;
			margin: 0;
			height: 100dvh;
			z-index: 21;
			text-align: unset;
			background: #ddd;
			border-radius: unset;
			transform: unset;

			> div {
				position: relative;
				display: block;
				margin: 0;
				padding: 0;
				border: 0;
				border-radius: 0;
				height: 100dvh;
				width: 100dvw;
				max-height: unset;
				min-height: unset;
				padding-top: 35px;
				max-width: unset;
				min-width: unset;

				form {
					> div.privacy {
						background: #efefef;
						outline: 1px solid #aaa;

						> div {
							display: unset;
							position: fixed;
							left: calc(50dvw - 200px);
							top: calc(50dvh - 75px);
							transform: unset;
						}
					}
				}

				> i.fa-xmark {
					font-size: 28px;
					color: #222;
				}

				> i.fa-xmark:hover {
					color: red;
				}

				> span {
					position: fixed;
					top: 10px;
					left: 10px;
					z-index: 30;
					opacity: 0.7;
				}

				label {
					margin: 5px;
					font-size: 14px;
				}

				input[type='text'] {
					width: calc(100vw - 12px);
					margin: 5px;
					border-radius: 0;
					padding: 10px;
					font-size: 14px;
				}

				> div {
					position: relative;
					display: block;
					height: calc(100% - 60px);
					width: calc(100vw - 12px);
					margin: 5px;
					border-radius: 0;
					border: 1px solid #aaa;
					max-height: unset;
					min-height: unset;
				}

				section {
					position: absolute;
					bottom: 70px;
					left: 10px;
					width: calc(100% - 20px);
				}

				form {
					display: flex;
					justify-content: space-evenly;
					position: relative;
					width: 100%;
					bottom: 0;
					left: 0;
					border: 0;
					height: 50px;
					background: #ddd;
				}
			}
		}
	}

	@media screen and (max-width: 600px) {
		:global(.closed) {
			display: none;
		}
	}

	:global(body.dark) {
		:global(code) {
			background: maroon;
		}

		dialog {
			background: #444;

			> div {
				background: #444;

				span {
					background: #555;
					color: white;
					border: 1px solid #333;
				}

				label {
					color: #ccc;
				}

				> div,
				input[type='text'] {
					background: #333;
					color: white;
					border: 1px solid #777;
				}

				div:focus,
				input[type='text']:focus {
					outline-color: maroon;
				}

				> i.fa-xmark {
					color: #ccc;
				}

				> i.fa-xmark:hover {
					color: red;
				}

				div.reply {
					border-color: #777;

					span {
						background: unset;
					}
				}

				section {
					div {
						i {
							background: #444;
							color: #aaa;

							&:hover {
								background: #333;
								color: #bbb;
							}
						}
					}
				}

				.compose-container {
					.drawer {
						background: #222;
						border-top: 1px solid #333;
						
						.drawer-content {
							.tabs {
								span {
									color: #ccc;
									background: inherit;
									border-color: #555;

									&:hover {
										background: #777;
									}

									&.selected {
										background: #444;
										color: #fff;
										border-color: #555;
									}
								}
							}

							.attachments,
							.tags {
								background: #444;
							}

							.tags {
								.hashtag-item {
									background: #555;
									color: #ccc;
								}

								.mention-item {
									background: #555;

									.mention-text {
										color: #ccc;

										&.error {
											color: #ff6b6b;
										}
									}

									i.fa-lock {
										color: #4caf50;
									}

									i.fa-exclamation-triangle {
										color: #ff9800;
									}
								}

								.no-tags {
									color: #777;
								}
							}
						}
					}
				}
			}

			form {
				background: #444;

				i {
					color: #ccc;
				}

				> div:hover {
					background: #555;
				}

				div.privacy {
					background: #555;

					> div {
						outline: 1px solid #777;
						background: #444;
					}

					h1 {
						color: white;
					}

					span {
						background: unset;
						border: 0;
					}

					li:hover {
						background: #777;

						h1 {
							color: darkred;
						}
					}
				}
			}
		}
	}

	.compose {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		right: 50px;
		bottom: 50px;
		background: #bbb;
		width: 60px;
		height: 60px;
		border-radius: 10px;
		opacity: 0.4;
		color: #777;
		transition-duration: 1s;
		z-index: 15;

		i {
			font-size: 24px;
		}
	}

	.compose:hover {
		cursor: pointer;
		color: white;
		background: darkred;
		opacity: 1;
		transition-duration: 1s;
	}

	@media screen and (max-width: 600px) {
		.compose {
			right: 20px;
			bottom: 60px;
		}
	}

	:global(body.dark) {
		.compose {
			background: #eee;
		}

		.compose:hover {
			cursor: pointer;
			color: white;
			background: maroon;
			opacity: 1;
			transition-duration: 1s;
		}
	}
</style>
