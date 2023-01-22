<script lang="ts">
	import { page } from '$app/stores';
	import { Converter } from 'showdown';
	console.log($page.params);

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		send_updated_summary,
		load_instance_information,
		upload_avatar,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state
	} from 'enigmatick_olm';

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
		type: string
		mediaType?: string
		url: string
	}

	type UserProfile = {
		'@context': string
		type: string
		name: string
		summary: string
		id: string
		preferredUsername: string
		inbox: string
		outbox: string
		followers: string
		following: string
		liked: string
		publicKey: object
		icon: Image
	};

	let profile: UserProfile | null = null;

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

		console.log($page.params);
		fetch('/user/' + $page.params.handle).then((x) => {
			x.json().then((y: UserProfile) => {
				profile = y;
			});
		});
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
			send_updated_summary(profile.summary).then((x) => {
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

	let avatar: string | ArrayBuffer | null, fileinput: HTMLInputElement;

	const onFileSelected = (e: Event) => {
		let target = e.target as HTMLInputElement;
		if (target.files !== null) {
			let image = target.files[0]
			let extension = String(image.name.match(/\.[0-9a-z]+$/i)).slice(1)
			let reader = new FileReader();
			reader.readAsArrayBuffer(image);
			reader.onload = (e: ProgressEvent<FileReader>) => {
				if (e.target !== null) {
					avatar = e.target.result !== null ? e.target.result : null;
					console.log(avatar);
					let bytes = new Uint8Array(avatar as ArrayBuffer);

					upload_avatar(bytes, (avatar as ArrayBuffer).byteLength, extension)
				}
			};
		}
	};

	let summary_changed = false;
	let edit_summary = false;
	let username = get(appData).username;
	let display_name = get(appData).display_name;
</script>

<header>
	<div>
		<span class="title"><a href="/">ENIGMATICK</a></span>
		{#if display_name}
			<nav>
				<span class="person"><a href="/@{username}">{display_name}</a></span>
			</nav>
		{/if}
	</div>
</header>
<main>
	{#if profile}
		<div class="profile">
			<div class="identity">
				<img src={profile.icon.url} alt="Default Person" on:click={() => {
					fileinput.click();
				}}/>
				<input
					style="display:none"
					type="file"
					accept=".jpg, .jpeg, .png"
					on:change={(e) => onFileSelected(e)}
					bind:this={fileinput}
				/>
				<h1>{profile.name}</h1>
			</div>

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

	header {
		width: 100%;
		padding: 5px;
		background: #222;
		color: #eee;
		text-align: center;
		font-family: 'Open Sans';
		font-size: 22px;
		font-weight: 600;

		a {
			color: #eee;
			text-decoration: none;
		}

		a:visited {
			color: #eee;
		}

		a:hover {
			color: red;
			transition-duration: 0.5s;
			text-decoration: none;
		}

		nav {
			display: block;
			position: absolute;
			right: 0;
			top: 0;
			padding: 2px 5px;
			text-align: right;

			.person {
				display: inline-block;
				font-size: 18px;
				font-weight: 400;
			}
		}

		@media screen and (max-width: 600px) {
			text-align: left;
		}
	}

	main {
		display: block;
		max-width: 800px;
		width: 100%;
		margin: 0 auto 0 auto;
		padding: 15px;
		font-family: 'Open Sans';

		.profile {
			width: 100%;

			.identity {
				display: flex;
				flex-direction: row;
				width: 100%;

				img {
					width: 150px;
					height: 150px;
					clip-path: inset(0 0 0 0 round 30px);
				}

				h1 {
					width: calc(100% - 150px);
					margin: 0;
					padding: 0 30px;
				}
			}

			.summary {
				width: 100%;

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

				div:hover,
				form:hover,
				button:hover {
					cursor: pointer;
				}
			}
		}
	}
</style>
