<script lang="ts">
	export { handleReplyToMessage, openAside, resetCompose };
	import showdown from 'showdown';
	const { Converter } = showdown;
	import showdownHighlight from 'showdown-highlight';
	import { appData, enigmatickWasm } from '../../../stores';
	import type { Attachment } from '../../../common';
	import type { ComposeDispatch } from './common';

	$: wasm = $enigmatickWasm;

	// Exporting the definition of this function is to allow Compose to be used in
	// different contexts, like for both Notes and EncryptedNotes. The implementation
	// of the sending function is left up to the container component.
	export let senderFunction: (
		recipientAddress: string | null,
		replyToMessageId: string | null,
		conversationId: string | null,
		content: string,
		attachments: Attachment[]
	) => Promise<boolean>;

	export let direct: boolean;

	async function handleReplyToMessage(message: CustomEvent<ComposeDispatch>) {
		console.log('IN COMPOSE');
		console.log(message);

		replyToRecipient = message.detail.replyToRecipient;
		replyToNote = message.detail.replyToNote;
		replyToDisplay = message.detail.replyToDisplay;
		replyToConversation = message.detail.replyToConversation;

		const replyToUrl = message.detail.replyToUrl;
		const replyToUsername = message.detail.replyToUsername;

		//const webfinger_acct = await get_webfinger_from_id(String(reply_to_recipient));
		markdownNote = `<span class="h-card"><a href="${replyToUrl}" class="u-url mention" rel="noopener noreferrer">@${replyToUsername}</a></span> `;
		htmlNote = convertToHtml(markdownNote);

		if (message.detail.openAside) {
			openAside();
		}
	}

	function openAside() {
		const dialog = document.getElementsByTagName('dialog')[0];
		dialog.showModal();

		const mask = document.getElementsByClassName('mask')[0];
		mask.classList.remove('closed');
	}

	function closeAside() {
		//cancelReplyTo();
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
		let compose = document.getElementById('compose');

		if (compose) {
			markdownNote = compose.innerText;
			htmlNote = convertToHtml(markdownNote);
		}
	}

	function handlePreview() {
		captureChanges();

		preview = !preview;
	}

	function resetCompose() {
		cancelReplyTo();
		preview = false;
		markdownNote = '';
		htmlNote = '';
	}

	function cancelReplyTo() {
		replyToNote = null;
		replyToDisplay = null;
		replyToConversation = null;
		replyToRecipient = null;
	}

	async function handlePublish() {
		captureChanges();

		console.log(`recipient: ${replyToRecipient}`);
		console.log(`reply_note: ${replyToNote}`);
		console.log(`reply_conversation: ${replyToConversation}`);
		console.log(`note: ${htmlNote}`);

		senderFunction(
			replyToRecipient,
			replyToNote,
			replyToConversation,
			htmlNote,
			Array.from(attachments.values())
		).then((x: any) => {
			if (x) {
				resetCompose();
				closeAside();
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

	$: markdownNote = '';
	$: htmlNote = '';
	let preview = false;

	let replyToRecipient: string | null = null;
	let replyToNote: string | null = null;
	let replyToDisplay: string | null = null;
	let replyToConversation: string | null = null;

	let imageBuffer: string | ArrayBuffer | null;
	let imageFileInput: HTMLInputElement;

	let attachments: Map<String, Attachment> = new Map();
	$: username = $appData.username;
</script>

<div class="mask closed" />
<dialog>
	{#if username}
		<div class={direct ? 'direct' : ''}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<i class="fa-solid fa-xmark" on:click={closeAside} />
			{#if replyToDisplay}
				<span
					>Replying to {@html replyToDisplay}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-xmark" on:click={cancelReplyTo} /></span
				>
			{/if}
			{#if direct}
				<i class="fa-solid fa-lock" />
				<label for="recipient">Recipient</label>
				<input id="recipient" name="recipient" type="text" placeholder="@joe@enigmatick.social" />
			{/if}
			{#if !preview}
				<pre id="compose" contenteditable="true">{markdownNote}</pre>
			{:else}
				<div>{@html htmlNote}</div>
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
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<i
					class="fa-solid fa-paperclip"
					on:keypress={() => {
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
				{#if preview}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-pen-nib" on:click|preventDefault={handlePreview} />
				{:else}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<i class="fa-solid fa-eye" on:click|preventDefault={handlePreview} />
				{/if}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<i class="fa-regular fa-paper-plane" on:click|preventDefault={handlePublish} />
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

		div {
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

			> i.fa-xmark {
				position: absolute;
				right: 10px;
				top: 5px;
				cursor: pointer;
			}

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
				border-radius: 10px;
				padding: 10px;
				margin: 0 0 5px 0;
				border: 0;
			}

			pre,
			div {
				position: relative;
				text-align: left;
				width: 100%;
				padding: 10px;
				margin: 0;
				background: white;
				min-height: 150px;
				max-height: 80vh;
				border: 1px solid #eee;
				font-family: 'Open Sans';
				border-radius: 10px;
				word-wrap: break-word;
				white-space: pre-wrap;
				overflow: scroll;
			}

			pre:focus,
			div:focus,
			input[type='text']:focus {
				outline: 1px solid darkgoldenrod;
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

			div {
				padding: 0 10px;
			}

			section {
				display: block;
				width: 100%;
				display: flex;
				flex-direction: row;
				flex-wrap: wrap;

				div {
					display: block;
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

				i {
					font-size: 24px;
					padding: 10px;
				}

				i:hover {
					cursor: pointer;
					color: red;
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

			div {
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

				span {
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

				pre,
				div {
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

			div.direct {
				pre,
				div {
					height: calc(100% - 128px);
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

			div {
				background: #444;

				span {
					background: #555;
					color: white;
					border: 1px solid #333;
				}

				label {
					color: #ccc;
				}

				pre,
				div,
				input[type='text'] {
					background: #333;
					color: white;
					border: 1px solid #777;
				}

				pre:focus,
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
			}

			form {
				background: #444;

				i {
					color: #ccc;
				}

				i:hover {
					color: red;
				}
			}
		}
	}

	.compose {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		right: calc(50% - 100px);
		bottom: 10px;
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
		background: maroon;
		opacity: 1;
		transition-duration: 1s;
	}

	@media screen and (max-width: 600px) {
		.compose {
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
