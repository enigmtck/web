<script lang="ts">
	export { handleReplyToMessage, openAside };
	import { Converter } from 'showdown';
	import showdownHighlight from 'showdown-highlight';
	import { appData } from '../../../stores';

    // Exporting the definition of this function is to allow Compose to be used in
    // different contexts, like for both Notes and EncryptedNotes. The implementation
    // of the sending function is left up to the container component.
	export let sender: (
		recipientAddress: string | null,
		replyToMessageId: string | null,
		conversationId: string | null,
		content: string
	) => Promise<boolean>;

	async function handleReplyToMessage(message: any) {
		console.log(message);

		replyToRecipient = message.detail.reply_to_recipient;
		replyToNote = message.detail.reply_to_note;
		replyToDisplay = message.detail.reply_to_display;
		replyToConversation = message.detail.reply_to_conversation;

		const reply_to_url = message.detail.reply_to_url;
		const reply_to_username = message.detail.reply_to_username;

		//const webfinger_acct = await get_webfinger_from_id(String(reply_to_recipient));
		markdownNote = `<span class="h-card"><a href="${reply_to_url}" class="u-url mention" rel="noopener noreferrer">@${reply_to_username}</a></span> `;
		htmlNote = convertToHtml(markdownNote);

		openAside();
	}

	function openAside() {
		const dialog = document.getElementsByTagName('dialog')[0];
		dialog.showModal();

		const mask = document.getElementsByClassName('mask')[0];
		mask.classList.remove('closed');
	}

	function closeAside() {
		cancelReplyTo();
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
		let compose;
		if ((compose = document.getElementById('compose'))) {
			compose.innerText = '';
		}

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
		markdownNote = '';
	}

	async function handlePublish() {
		captureChanges();

		sender(replyToRecipient, replyToNote, replyToConversation, htmlNote).then((x: any) => {
			if (x) {
				resetCompose();
				closeAside();
				console.log('send successful');
			} else {
				console.log('send unsuccessful');
			}
		});
	}

	let markdownNote = '';
	let htmlNote = '';
	let preview = false;

	let replyToRecipient: string | null = null;
	let replyToNote: string | null = null;
	let replyToDisplay: string | null = null;
	let replyToConversation: string | null = null;

	$: username = $appData.username;
</script>

<div class="mask closed" />
<dialog>
	{#if username}
		<div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<i class="fa-solid fa-xmark" on:click={closeAside} />
			{#if replyToDisplay}
				<span
					>Replying to {replyToDisplay}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i class="fa-solid fa-xmark" on:click={cancelReplyTo} /></span
				>
			{/if}
			{#if !preview}
				<pre id="compose" contenteditable="true">{markdownNote}</pre>
			{:else}
				<div>{@html htmlNote}</div>
			{/if}

			<form method="POST" on:submit|preventDefault={handleComposeSubmit}>
				<i class="fa-solid fa-paperclip" />
				{#if preview}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i class="fa-solid fa-pen-nib" on:click|preventDefault={handlePreview} />
				{:else}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<i class="fa-solid fa-eye" on:click|preventDefault={handlePreview} />
				{/if}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<i class="fa-regular fa-paper-plane" on:click|preventDefault={handlePublish} />
			</form>
		</div>
	{/if}
</dialog>

{#if username}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
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

			> i {
				position: absolute;
				right: 10px;
				top: 5px;
			}

			> span {
				display: inline-block;
				background: #efefef;
				border: 1px solid #ccc;
				padding: 4px;
				margin: 5px 0;
				font-family: 'Open Sans';
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

			div {
				padding: 0 10px;
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

				button {
					display: inline-block;
					margin: 5px;
					padding: 5px 15px;
					background: darkred;
					color: whitesmoke;
					border: 0;
					font-family: 'Open Sans';
					font-size: 18px;
					font-weight: 600;
				}

				button:hover {
					color: darkred;
					background: whitesmoke;
					cursor: pointer;
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

			.mask {
				display: none;
			}

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

				> i {
					font-size: 28px;
					color: #222;
				}

				> i:hover {
					color: red;
				}

				span {
					position: fixed;
					top: 10px;
					left: 10px;
					z-index: 30;
					opacity: 0.7;
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

					button {
						position: fixed;
						top: 40px;
						right: 10px;
						border-radius: 5px;
					}
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
		:global(dialog > div > div > p > code) {
			background: #222;
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

				pre,
				div {
					background: #333;
					color: white;
					border: 1px solid #777;
				}

				> i {
					color: #ccc;
				}

				> i:hover {
					color: red;
				}
			}

			.mask {
				background: black;
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
		right: calc(50% - 30px);
		bottom: 10px;
		background: #eee;
		width: 60px;
		height: 60px;
		border-radius: 10px;
		opacity: 0.2;
		border: 1px solid #ccc;
		color: #444;
		transition-duration: 1s;
		z-index: 15;

		i {
			font-size: 24px;
		}
	}

	.compose:hover {
		cursor: pointer;
		color: red;
		opacity: 1;
		transition-duration: 1s;
	}

	@media screen and (max-width: 600px) {
		.compose {
			bottom: 60px;
		}
	}
</style>
