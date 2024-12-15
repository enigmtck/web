<script lang="ts">
	export { handleReplyToMessage, openAside, resetCompose };
	import showdown from 'showdown';
	const { Converter } = showdown;
	import showdownHighlight from 'showdown-highlight';
	import { appData, enigmatickWasm } from '../../../stores';
	import {
		cachedContent,
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
		replyToNote: Note | null,
		content: string,
		attachments: Attachment[],
		mentions: Map<string, UserProfile>,
		tags: string[],
		directed: boolean
	) => Promise<string | null | undefined>;

	export let direct: boolean;

	async function handleReplyToMessage(message: CustomEvent<ComposeDispatch>) {
		console.log('IN COMPOSE');
		console.log(message);

		replyToActor = message.detail.replyToActor;
		replyToNote = message.detail.replyToNote;

		if (replyToNote.type == 'EncryptedNote') {
			direct = true;
		}

		let webfinger = await wasm?.get_webfinger_from_id(replyToActor.id as string);
		markdownNote = `${webfinger} `;
		htmlNote = convertToHtml(markdownNote);

		await tick();

		if (message.detail.openAside) {
			openAside();
		}

		if (composeDiv) {
			annotate(true);
		}
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

		if (composeDiv) {
			annotate(true);
		}
	}

	function resetCompose() {
		cancelReplyTo();
		preview = false;
		markdownNote = '';
		htmlNote = '';
		mentions.clear();
		hashtags.clear();
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
		).then((x: any) => {
			if (x) {
				resetCompose();
				closeAside();

				let activity: Activity = JSON.parse(x);

				publishDispatch('publish', {
					activity
				});

				console.log(activity);
				console.log('send successful');
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

	const annotate = async (full: boolean) => {
		if (!full) {
			let text = getTextBeforeCursor(composeDiv);
			if (!text.match(mentionRegex) && !text.match(hashtagRegex)) {
				return;
			}
		}

		const selection = window.getSelection();
		const range = selection?.getRangeAt(0);
		const cursorPosition = range?.startOffset || 0;

		// Calculate total offset
		const currentNode = range?.startContainer;
		let totalOffset = cursorPosition;

		let previousNode = currentNode?.previousSibling;
		while (previousNode) {
			totalOffset += previousNode.textContent?.length || 0;
			previousNode = previousNode.previousSibling;
		}

		// Parse content with newlines
		let newValue = '';
		let isOnFreshLine = true;

		function parseNodes(childNodes: NodeListOf<ChildNode>) {
			for (let i = 0; i < childNodes.length; i++) {
				const node = childNodes[i];
				if (node.nodeName === 'BR') {
					newValue += '\n';
					isOnFreshLine = true;
				} else if (node.nodeName === 'DIV' && !isOnFreshLine) {
					newValue += '\n';
					isOnFreshLine = false;
				}

				if (node.nodeType === 3 && node.textContent) {
					newValue += node.textContent;
					isOnFreshLine = false;
				}

				if (node.childNodes.length > 0) {
					parseNodes(node.childNodes);
				}
			}
		}

		parseNodes(composeDiv.childNodes);

		// Process content
		const processedMentions = await annotateMentions(
			newValue.replace(/</g, '&lt;').replace(/>/g, '&gt;')
		);

		const processedHashtags = annotateHashtags(processedMentions);

		composeDiv.innerHTML = processedHashtags;

		// Restore cursor position
		const nodes = Array.from(composeDiv.childNodes);
		let accumulatedLength = 0;
		let targetNode = null;
		let targetOffset = 0;

		for (const node of nodes) {
			const nodeLength = node.textContent?.length || 0;
			if (accumulatedLength + nodeLength >= totalOffset) {
				targetNode = node;
				targetOffset = totalOffset - accumulatedLength;
				break;
			}
			accumulatedLength += nodeLength;
		}

		if (selection && targetNode) {
			const newRange = document.createRange();
			selection.removeAllRanges();
			newRange.setStart(targetNode, targetOffset);
			newRange.collapse(true);
			selection.addRange(newRange);
		}
	};

	const checkForAddresses = async (event: KeyboardEvent) => {
		switch (event.key) {
			case ' ':
				annotate(false);
				event.preventDefault();
				break;
			case 'Backspace':
				const selection = window.getSelection();
				if (selection) {
					const range = selection.getRangeAt(0);
					if (range) {
						const node = range.startContainer;

						const currentSpan =
							node.nodeType === Node.TEXT_NODE
								? node.parentElement?.closest('span')
								: node instanceof Element
								? node.closest('span')
								: null;

						if (
							currentSpan &&
							range.collapsed &&
							node.textContent &&
							range.startOffset === node.textContent.length
						) {
							event.preventDefault();
							currentSpan.remove();
						}
					}
				}
				break;
		}
	};

	$: markdownNote = '';
	$: htmlNote = '';
	let preview = false;

	let webfingerRecipient: string | null = null;
	let replyToActor: UserProfile | UserProfileTerse | null = null;
	let replyToNote: Note | null = null;

	let imageBuffer: string | ArrayBuffer | null;
	let imageFileInput: HTMLInputElement;

	let attachments: Map<String, Attachment> = new Map();
	let mentions: Map<string, UserProfile | null> = new Map();
	let hashtags: Set<string> = new Set();
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
						<span>{removeTags(replyToNote.content)}</span>
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<i class="fa-solid fa-xmark" on:click|preventDefault={cancelReplyTo} />
					</div>
				{/if}
				<div
					class="entry"
					bind:this={composeDiv}
					contenteditable="true"
					on:keyup={checkForAddresses}
					on:focusout={(e) => {
						annotate(true);
					}}
					bind:innerText={markdownNote}
				/>
			</div>

			{#if preview}
				<div class="preview">{@html htmlNote}</div>
			{/if}

			<section>
				{#each Array.from(attachments.values()) as attachment}
					<!-- svelte-ignore a11y-missing-attribute -->
					<div>
						<img src={attachment.url} width={attachment.width} height={attachment.height} />
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<i
							class="fa-solid fa-xmark"
							data-url={attachment.url}
							on:click|preventDefault={removeAttachment}
						/>
					</div>
				{/each}
			</section>

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
		min-height: 220px;
		min-width: 400px;
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
			right: 10px;
			top: 5px;
			cursor: pointer;
		}

		> div {
			position: relative;
			display: flex;
			flex-direction: column;
			height: 100%;
			width: 100%;
			max-width: 700px;
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
				min-height: 150px;
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
						width: auto;
						height: auto;
						object-fit: fill;
						opacity: 0.8;
					}
				}
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
					}
				}

				> div:hover {
					cursor: pointer;
					outline: 1px solid #aaa;
					background: #efefef;
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
			height: 100%;
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
				height: 100%;
				width: 100%;
				max-height: unset;
				min-height: unset;
				padding-top: 35px;
				max-width: unset;
				min-width: unset;

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
