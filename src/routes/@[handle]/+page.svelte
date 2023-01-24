<script lang="ts">
	import { page } from '$app/stores';
	import { Converter } from 'showdown';
	console.log($page.params);

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		update_summary,
		load_instance_information,
		upload_avatar,
		upload_banner,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state
	} from 'enigmatick_olm';
	import { goto } from '$app/navigation';

	function load_enigmatick() {
		init_olm().then(() => {
			if (get(olmState)) {
				import_olm_state(get(olmState));
				console.log('loaded olm state from store');
			}
			console.log('init OLM');
		});
	}

	type Image = {
		type: string;
		mediaType?: string;
		url: string;
	};

	type UserProfile = {
		'@context': string;
		type: string;
		name: string;
		summary: string;
		id: string;
		preferredUsername: string;
		inbox: string;
		outbox: string;
		followers: string;
		following: string;
		liked: string;
		publicKey: object;
		icon: Image;
		image?: Image;
		url: string;
	};

	let profile: UserProfile | null = null;

	function load_profile() {
		if ($page.params.handle) {
			fetch('/user/' + $page.params.handle).then((x) => {
				x.json().then((y: UserProfile) => {
					console.log(y);
					profile = y;
				});
			});
		}
	}

	onMount(() => {
		load_enigmatick();

		if (username) {
			init_wasm().then(() => {
				load_instance_information().then((instance) => {
					console.log(instance?.domain);
					console.log(instance?.url);

					if (get(wasmState)) {
						get_wasm_state().then(() => {
							import_wasm_state(get(wasmState));
							console.log('loaded state from store');
						});
					}
					console.log('init WASM');
				});
			});
		}

		load_profile();
	});

	function convertToMarkdown(data: string) {
		let converter = new Converter();
		converter.setFlavor('github');
		converter.setOption('tables', true);
		converter.setOption('requireSpaceBeforeHeadingText', true);
		return converter.makeMarkdown(data);
	}

	function convertToHtml(data: string) {
		let converter = new Converter();
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
			edit_summary = true;
		}
	}

	function handlePreview(event: any) {
		let data = new FormData(event.target);

		if (profile) {
			edit_summary = false;
			profile.summary = convertToHtml(String(data.get('summary')));
			summary_changed = true;
		}
	}

	function handleCancel(event: any) {
		edit_summary = false;
	}

	function handleSaveSummary() {
		if (profile) {
			update_summary(profile.summary).then((x) => {
				console.log(x);
				summary_changed = false;
			});
		}
	}

	function handleUpdate(event: any) {
		let t: HTMLTextAreaElement | null = <HTMLTextAreaElement>(
			document.getElementById('summary_textarea')
		);

		if (t) {
			t.value = event.target.innerText;
		}
	}

	let avatar: string | ArrayBuffer | null, avatar_file_input: HTMLInputElement;

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

					upload_avatar(bytes, (avatar as ArrayBuffer).byteLength, extension).then(() => {
						load_profile();
					});
				}
			};
		}
	};

	let banner: string | ArrayBuffer | null, banner_file_input: HTMLInputElement;

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

					upload_banner(bytes, (banner as ArrayBuffer).byteLength, extension).then(() => {
						load_profile();
					});
				}
			};
		}
	};

	let summary_changed = false;
	let edit_summary = false;
	let username = get(appData).username;
	let display_name = get(appData).display_name;
</script>

<main>
	{#if profile}
		<div class="profile">
			{#if profile.image}
				{#if username}
					<div class="banner">
						<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
						<!-- svelte-ignore a11y-positive-tabindex -->
						<img
							class="selectable"
							src={profile.image.url}
							tabindex="3"
							alt="Banner"
							on:keypress={() => {
								banner_file_input.click();
							}}
							on:click={() => {
								banner_file_input.click();
							}}
						/>
					</div>
				{/if}

				{#if !username}
					<div class="banner">
						<img src={profile.image.url} alt="Banner" />
					</div>
				{/if}
			{/if}

			<div class="identity">
				<div class="avatar">
					{#if username}
						<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
						<!-- svelte-ignore a11y-positive-tabindex -->
						<img
							class="selectable"
							src={profile.icon.url}
							alt="Avatar"
							tabindex="2"
							on:keypress={() => {
								avatar_file_input.click();
							}}
							on:click={() => {
								avatar_file_input.click();
							}}
						/>
						<input
							style="display:none"
							type="file"
							accept=".jpg, .jpeg, .png"
							on:change={(e) => onAvatarSelected(e)}
							bind:this={avatar_file_input}
						/>
					{/if}

					{#if !username}
						<img src={profile.icon.url} alt="Avatar" />
					{/if}
				</div>
				<div class="details">
					<h1>{profile.name}</h1>
					<a href={profile.url}>{profile.url}</a>
				</div>
			</div>
			{#if username}
				<div class="controls">
					{#if !profile.image}
						<button
							on:keypress={() => {
								banner_file_input.click();
							}}
							on:click={() => {
								banner_file_input.click();
							}}>Set Banner</button
						>
					{/if}
					<input
						style="display:none"
						type="file"
						accept=".jpg, .jpeg, .png"
						on:change={(e) => onBannerSelected(e)}
						bind:this={banner_file_input}
					/>

					<button
						on:click|preventDefault={() => {
							goto('/settings');
						}}>Settings</button
					>
				</div>
			{/if}
			<div class="summary">
				{#if edit_summary}
					<pre contenteditable="true" on:input|preventDefault={handleUpdate}>{convertToMarkdown(
							profile.summary
						)}</pre>
					<form method="POST" on:submit|preventDefault={handlePreview}>
						<textarea id="summary_textarea" name="summary"
							>{convertToMarkdown(profile.summary)}</textarea
						>
						<button on:click|preventDefault={handleCancel}>Cancel</button>
						<button>Preview</button>
					</form>
				{/if}

				{#if username && !edit_summary}
					<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
					<!-- svelte-ignore a11y-positive-tabindex -->
					<div
						class="selectable"
						tabindex="1"
						on:click|preventDefault={handleEdit}
						on:keypress|preventDefault={handleEdit}
					>
						{@html profile.summary}
					</div>

					{#if summary_changed}
						<button on:click|preventDefault={handleSaveSummary}>Save Changes</button>
					{/if}
				{/if}

				{#if !username}
					<span>{@html profile.summary}</span>
				{/if}
			</div>
		</div>
	{/if}
</main>

<style lang="scss">
	:global(li) {
		padding: 5px 0;
	}

	:global(pre) {
		padding: 10px;
		line-height: 1.75em;
		word-wrap: normal;
		white-space: pre-wrap;
	}

	:global(code) {
		display: inline;
		font-size: 14px;
		padding: 3px;
		border-radius: 4px;
		background: #f5f5f5;
	}

	:global(a),
	:global(a:visited) {
		color: black;
	}

	:global(a:hover) {
		color: red;
		transition-duration: 0.5s;
	}

	main {
		display: block;
		max-width: 800px;
		width: 100%;
		margin: 0 auto 0 auto;
		font-family: 'Open Sans';

		:global(.selectable:hover),
		:global(.selectable:focus) {
			cursor: pointer;
			color: darkred;
			transition-duration: 0.5s;
			opacity: 0.8;
		}

		.profile {
			width: 100%;
			display: flex;
			flex-direction: column;

			.banner {
				z-index: 20;
				width: 100%;
				max-height: 300px;
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

				margin-top: -10%;

				.avatar {
					z-index: 30;
					margin: 0 5%;
					width: 20%;
					height: 20%;
					overflow: none;

					img {
						width: 100%;
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
					margin-top: 10%;
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
				text-align: right;

				button {
					display: inline-block;
					color: whitesmoke;
					background: darkred;
					border: 0;
					transition-duration: 1s;
					font-size: 18px;
					font-weight: 600;
					padding: 5px 15px;
					margin: 5px;
					border-radius: 7px;
				}

				button:hover {
					color: darkred;
					background: whitesmoke;
					transition-duration: 1s;
					cursor: pointer;
				}
			}

			.summary {
				width: 100%;
				padding: 0 15px;

				> pre {
					border: 1px solid #eee;
				}

				:global(div > pre),
				:global(span > pre) {
					color: #444;
					background: #f5f5f5;
				}

				form {
					width: 100%;

					textarea {
						display: none;
					}
				}
			}
		}
	}
</style>
