<script lang="ts">
	import { page } from '$app/stores';
	import showdown from 'showdown';
	const { Converter } = showdown;
	import showdownHighlight from 'showdown-highlight';
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, appData, enigmatickWasm } from '../../stores';
	import type { UserProfile } from '../../common';
	import { goto } from '$app/navigation';

	$: wasm = $enigmatickWasm;
	$: username = $appData.username;
	$: displayName = $appData.display_name;

	let profile: UserProfile | null = null;

	function loadProfile() {
		if ($page.params.handle) {
			fetch('/user/' + $page.params.handle, {
				headers: {
					Accept: 'application/json'
				}
			}).then((x) => {
				x.json().then((y: UserProfile) => {
					console.log(y);
					profile = y;
					summaryMarkdown = y.ephemeralSummaryMarkdown || '';
				});
			});
		}
	}

	function convertToMarkdown(data: string) {
		let converter = new Converter({
			extensions: [
				showdownHighlight({
					pre: true,
					auto_detection: true
				})
			]
		});
		converter.setFlavor('github');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeMarkdown(data);
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
		converter.setFlavor('github');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeHtml(data);
	}

	function handleEdit(event: any) {
		if (
			(event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) ||
			(event instanceof MouseEvent && event.type === 'click')
		) {
			editSummary = true;
		}
	}

	function handlePreview(event: any) {
		let el = document.getElementById('summary_edit');

		if (el) {
			let data = el.innerText;

			if (profile) {
				summaryMarkdown = data;
				editSummary = false;
				profile.summary = convertToHtml(data);
				summaryChanged = true;
			}
		}
	}

	function handleCancel(event: any) {
		editSummary = false;
	}

	function handleSaveSummary() {
		if (profile && profile.summary) {
			wasm?.update_summary(profile.summary, summaryMarkdown).then((x: any) => {
				console.log(x);
				summaryChanged = false;
			});
		}
	}

	let avatar: string | ArrayBuffer | null, avatarFileInput: HTMLInputElement;

	const onAvatarSelected = (e: Event) => {
		let target = e.target as HTMLInputElement;
		if (target.files !== null) {
			let image = target.files[0];
			let extension = String(image.name.match(/\.[0-9a-z]+$/i)).slice(1);
			let reader = new FileReader();
			reader.readAsArrayBuffer(image);
			reader.onload = (e: ProgressEvent<FileReader>) => {
				if (e.target !== null) {
					avatar = e.target.result !== null ? e.target.result : null;
					console.log(avatar);
					let bytes = new Uint8Array(avatar as ArrayBuffer);

					wasm?.upload_avatar(bytes, (avatar as ArrayBuffer).byteLength, extension).then(() => {
						loadProfile();
					});
				}
			};
		}
	};

	let banner: string | ArrayBuffer | null, bannerFileInput: HTMLInputElement;

	const onBannerSelected = (e: Event) => {
		let target = e.target as HTMLInputElement;
		if (target.files !== null) {
			let image = target.files[0];
			let extension = String(image.name.match(/\.[0-9a-z]+$/i)).slice(1);
			let reader = new FileReader();
			reader.readAsArrayBuffer(image);
			reader.onload = (e: ProgressEvent<FileReader>) => {
				if (e.target !== null) {
					banner = e.target.result !== null ? e.target.result : null;
					console.log(banner);
					let bytes = new Uint8Array(banner as ArrayBuffer);

					wasm?.upload_banner(bytes, (banner as ArrayBuffer).byteLength, extension).then(() => {
						loadProfile();
					});
				}
			};
		}
	};

	let summaryChanged = false;
	let editSummary = false;
	let summaryMarkdown = '';

	$: if ($enigmatickWasm) {
		loadProfile();
	}
</script>

<main>
	{#if profile}
		<div class="profile">
			<div class="banner">
				{#if profile.image}
					{#if username}
						<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
						<!-- svelte-ignore a11y-positive-tabindex -->
						<img
							class="selectable"
							src={profile.image.url}
							tabindex="3"
							alt="Banner"
							on:keypress={() => {
								bannerFileInput.click();
							}}
							on:click={() => {
								bannerFileInput.click();
							}}
						/>
					{:else if !username}
						<img src={profile.image.url} alt="Banner" />
					{/if}
				{/if}
			</div>
			<div class="identity">
				<div class="avatar">
					{#if username}
						<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
						<!-- svelte-ignore a11y-positive-tabindex -->
						<img
							class="selectable"
							src={profile.icon?.url}
							alt="Avatar"
							tabindex="2"
							on:keypress={() => {
								avatarFileInput.click();
							}}
							on:click={() => {
								avatarFileInput.click();
							}}
						/>
						<input
							style="display:none"
							type="file"
							accept=".jpg, .jpeg, .png"
							on:change={(e) => onAvatarSelected(e)}
							bind:this={avatarFileInput}
						/>
					{/if}

					{#if !username}
						<img src={profile.icon?.url} alt="Avatar" />
					{/if}
				</div>
				<div class="details">
					<h1>{profile.name}</h1>
					<a href={profile.url}>{profile.url}</a>
				</div>
			</div>
			{#if username}
				<div class="controls">
					<div>
						<button
							title="Change Avatar"
							on:keypress={() => {
								avatarFileInput.click();
							}}
							on:click={() => {
								avatarFileInput.click();
							}}
						>
							<i class="fa-solid fa-image-portrait" />
						</button>
						<button
							title="Change Banner"
							on:keypress={() => {
								bannerFileInput.click();
							}}
							on:click={() => {
								bannerFileInput.click();
							}}
						>
							<i class="fa-solid fa-panorama" />
						</button>
						{#if !editSummary}
							<button
								title="Update Biography"
								on:click|preventDefault={handleEdit}
								on:keypress|preventDefault={handleEdit}
							>
								<i class="fa-solid fa-pencil" />
							</button>
						{/if}
						<input
							style="display:none"
							type="file"
							accept=".jpg, .jpeg, .png"
							on:change={(e) => onBannerSelected(e)}
							bind:this={bannerFileInput}
						/>

						{#if editSummary}
							<button title="Cancel" on:click|preventDefault={handleCancel}
								><i class="fa-solid fa-ban" /></button
							>
							<button title="Preview" on:click|preventDefault={handlePreview}
								><i class="fa-solid fa-magnifying-glass" /></button
							>
							{#if summaryChanged}
								<button on:click|preventDefault={handleSaveSummary} title="Save"
									><i class="fa-solid fa-floppy-disk" /></button
								>
							{/if}
						{:else if summaryChanged}
							<button on:click|preventDefault={handleSaveSummary} title="Save"
								><i class="fa-solid fa-floppy-disk" /></button
							>
						{/if}
					</div>
				</div>
			{/if}
			<div class="summary">
				{#if editSummary}
					<pre id="summary_edit" contenteditable="true">{summaryMarkdown}</pre>
				{/if}

				{#if username && !editSummary}
					<button
						class="transparent"
						on:click|preventDefault={handleEdit}
						on:keypress|preventDefault={handleEdit}
					/>
					<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
					<!-- svelte-ignore a11y-positive-tabindex -->
					<div>
						{@html profile.summary || ''}
					</div>
				{/if}

				{#if !username}
					<span>{@html profile.summary || ''}</span>
				{/if}
			</div>
		</div>
	{/if}
</main>

<style lang="scss">
	main {
		grid-area: content;
		max-width: 800px;
		width: 100%;
		height: calc(100% - 41px);
		margin: 0 auto;
		font-family: 'Open Sans';

		.profile {
			width: 100%;
			display: flex;
			flex-direction: column;

			button {
				display: inline-block;
				background: unset;
				border: 0;
				font-size: 18px;
				padding: 5px;
			}

			button:hover {
				color: darkred;
				cursor: pointer;
			}

			button.transparent {
				display: block;
				position: absolute;
				left: 0;
				top: 0;
				width: 100%;
				height: 100%;
				color: unset;
				background: unset;
				border: 0;
				font-size: unset;
				font-weight: unset;
				padding: unset;
				margin: unset;
				opacity: 0.1;
				text-align: left;
			}

			button.transparent:hover {
				background: #aaa;
			}

			.banner {
				z-index: 20;
				width: 100%;
				max-height: 300px;
				min-height: 100px;
				overflow: hidden;

				img {
					width: 100%;
				}
			}

			.identity {
				display: flex;
				flex-direction: row;
				width: 100%;

				/* percentage margins here are weird because they are relative 
				   to width only, but make sense for this use-case; the square 
				   avatar is 20% wide, and we want it half-way overlapping in 
				   the banner - that means that .details is also shifted by 10% 
				   down to undo the overlap */

				.avatar {
					z-index: 30;
					margin: 0 5%;
					width: 20%;
					height: 20%;
					overflow: none;

					img {
						width: 100%;
						margin-top: -50%;
						clip-path: inset(0 0 0 0 round 10%);
					}

					img:focus {
						opacity: 0.75;
					}
				}

				.details {
					z-index: 10;
					display: flex;
					flex-direction: column;
					width: 70%;
					overflow: hidden;

					h1 {
						font-size: 24px;
					}

					h1,
					a {
						width: 100%;
						margin: 0;
						padding: 0;
					}

					a {
						text-decoration: none;
						font-size: 18px;
					}

					@media screen and (max-width: 600px) {
						a {
							display: none;
						}
					}
				}
			}

			.controls {
				width: 100%;
				padding: 10px;
				text-align: center;

				> div {
					display: inline-block;
					width: unset;
					background: #ddd;
					border-radius: 10px;
					padding: 5px;

					i {
						font-size: 18px;
						color: #444;
						padding: 0 5px;
						transition-duration: 500ms;
					}

					i:hover {
						color: red;
						cursor: pointer;
					}
				}
			}

			.summary {
				position: relative;
				width: 100%;
				padding: 5px;
				height: auto;
				min-height: 50px;

				> pre {
					position: relative;
					margin: 0;
					padding: 5px;
					height: auto;
					width: 100%;
					min-height: 50px;
				}

				> pre:focus {
					outline: 1px solid #aaa;
				}

				form {
					width: 100%;
				}
			}
		}
	}

	:global(body.dark) {
		main {
			.profile {
				border: 0;
				background: #333;

				.banner {
					background: inherit;
				}

				.identity {
					background: inherit;

					span {
						color: #ccc;
					}

					a {
						color: #aaa;
					}

					.details {
						h1 {
							color: #ddd;
						}
					}
				}

				.controls {
					background: inherit;
				}

				.summary {
					color: #fff;
					background: #222;

					:global(p) {
						color: inherit;
					}

					:global(a) {
						color: #aaa;
					}

					:global(a:hover) {
						color: red;
					}
				}
			}
		}
	}
</style>
