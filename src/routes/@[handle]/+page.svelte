<script lang="ts">
	import { page } from '$app/stores';
	import showdown from 'showdown';
	const { Converter } = showdown;
	import showdownHighlight from 'showdown-highlight';
	import { appData, enigmatickWasm } from '../../stores';
	import {
		type UserProfile,
		type Collection,
		insertEmojis,
		getWebFingerFromId,
		cachedContent,
		convertMastodonUrlToWebfinger,
		getFirst,
		abbreviateNumber,

		type Activity

	} from '../../common';
	import Posts from './components/Posts.svelte';

	$: wasm = $enigmatickWasm;
	$: username = $appData.username;

	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import Follows from './components/Follows.svelte';

	onMount(async () => {});

	async function loadProfile(handle: string) {
		console.debug(`INSTANCE DOMAIN: ${$appData.domain}`);
		console.log(`GETTING ${handle}`);

		if (handle.includes('@')) {
			console.debug('REQUEST FOR REMOTE PROFILE');
			local = false;

			// The '@' below is the prepended one; the '@' above is the one in the middle
			let p = await cachedActor(`@${handle}`, cache);
			// let p = await wasm?.get_actor_cached(cache, `@${handle}`).catch((e) => {
			// 	 console.error(`FAILED TO RETRIEVE: ${handle}`);
			// 	 return null;
			// });

			profile = JSON.parse(p);
			console.debug(profile);

			if (postsComponent && profile) {
				postsComponent.local = local;
				postsComponent.handle = handle;
				postsComponent.profile = profile;
			}

			wasm?.get_remote_followers(`@${handle}`).then((x) => {
				if (x) {
					let followers: Collection = JSON.parse(x);
					followerCount = followers.totalItems || 0;
				}
			});

			wasm?.get_remote_following(`@${handle}`).then((x) => {
				if (x) {
					let following: Collection = JSON.parse(x);
					followingCount = following.totalItems || 0;
				}
			});
		} else {
			console.debug('REQUEST FOR LOCAL PROFILE');
			local = true;

			wasm?.get_profile_by_username(handle).then((x) => {
				console.log('IN get_profile_by_username');
				if (x) {
					console.log(x);
					profile = JSON.parse(x);
					console.debug(profile);
					if (postsComponent && profile) {
						postsComponent.local = local;
						postsComponent.handle = handle;
						postsComponent.profile = profile;
					}
					summaryMarkdown = profile?.ephemeral?.summaryMarkdown || '';
				}
			});
		}
	}

	async function cachedActor(id: string, cache: any) {
		if (cache) {
			try {
				console.debug(`RETRIEVING ${id} FROM CACHE`);
				return await wasm?.get_actor_cached(cache, id);
			} catch (e) {
				console.error(`FAILED TO RETRIEVE: ${id}`);
				return null;
			}
		}

		return null;
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
						loadProfile($page.params.handle);
					});
				}
			};
		}
	};

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
						loadProfile($page.params.handle);
					});
				}
			};
		}
	};

	function handleFollow(event: Event) {
		if (profile && profile.id) {
			console.log('Following: ' + profile.id);

			wasm?.send_follow(profile.id).then((x) => {
				if (x && profile) {
					let activity: Activity = JSON.parse(x);
					console.debug(`Follow sent: ${activity.id}`);
					let ephemeral = profile.ephemeral || {};
					ephemeral.following = true;
					profile.ephemeral = ephemeral;
				}
			});
		} else {
			console.log('no profile loaded');
		}
	}

	function handleUnfollow(activity: string | undefined) {
		if (activity && profile && profile.id) {
			console.log('Unfollowing: ' + profile.id);

			wasm?.send_unfollow(profile.id, activity).then((x) => {
				if (x && profile) {
					let activity: Activity = JSON.parse(x);
					console.debug(`Unfollow sent: ${activity.id}`);
					let ephemeral = profile.ephemeral || {};
					ephemeral.following = false;
					profile.ephemeral = ephemeral;
				}
			});
		} else {
			console.log('no profile loaded');
		}
	}

	async function handleKexInit(event: any) {
		console.log(event);
	}

	const Views = {
		Articles: Symbol('articles'),
		Posts: Symbol('posts'),
		Followers: Symbol('followers'),
		Following: Symbol('following')
	};

	let avatar: string | ArrayBuffer | null, avatarFileInput: HTMLInputElement;
	let banner: string | ArrayBuffer | null, bannerFileInput: HTMLInputElement;
	let currentView = Views.Posts;
	let summaryChanged = false;
	let editSummary = false;
	let summaryMarkdown = '';

	let followerCount = 0;
	let followingCount = 0;

	let followersComponent: Follows | null;
	let followingComponent: Follows | null;
	let postsComponent: Posts | null;
	let profile: UserProfile | null = null;
	let local = true;
	let cache: any = null;

	$: if ($enigmatickWasm) {
		cache = new $enigmatickWasm.EnigmatickCache();
		loadProfile($page.params.handle);
	}

	beforeNavigate(async (navigation) => {
		console.debug(navigation);
		if (navigation.to) {
			if (navigation.to.route.id === null) {
				let actor = navigation.to.url.href;

				// we want to catch the calls to external profiles so that we can offer actions on them; the
				// intention of this expression is to match Mastodon-isms like (with grouping notated)
				// ^https://(ser)(.endipito)(.us)/@justin$ or ^https://(infosec)(.exchange)/@jdt$
				const re = /^https:\/\/(:?[a-zA-Z0-9\-]+)(:?\.[a-zA-Z0-9\-]+)+?\/@[a-zA-Z0-9_]+\/?$/;

				if (actor.match(re)) {
					let webfinger = convertMastodonUrlToWebfinger(actor);

					if (webfinger) {
						console.log(`WEBFINGER: ${webfinger}`);
						navigation.cancel();

						goto(`/${webfinger}`).then(() => {
							currentView = Views.Posts;
						});
					}
				}
			}
		}
	});
</script>

<main>
	{#if profile}
		<div class="profile">
			<div class="banner">
				{#if username}
					<input
						style="display:none"
						type="file"
						accept=".jpg, .jpeg, .png"
						on:change={(e) => onBannerSelected(e)}
						bind:this={bannerFileInput}
					/>
				{/if}
				{#if profile.image}
					<img src={cachedContent(wasm, String(profile.image.url))} alt="Banner" />
				{/if}
			</div>
			<div class="identity">
				<div class="avatar">
					{#if username}
						<input
							style="display:none"
							type="file"
							accept=".jpg, .jpeg, .png"
							on:change={(e) => onAvatarSelected(e)}
							bind:this={avatarFileInput}
						/>
					{/if}

					<img src={cachedContent(wasm, String(profile.icon?.url))} alt="Avatar" />
				</div>
				<div class="details">
					{#if profile.name}
						<h1>{@html insertEmojis(wasm, profile.name, profile)}</h1>
					{/if}

					<a href={getFirst(profile.url)}>{getWebFingerFromId(profile)}</a>
				</div>
			</div>
			{#if username}
				<div class="controls">
					<!-- This is super convoluted. The goal is to hide this if it's the user's own profile. -->
					{#if $appData.domain && (!profile.id?.includes($appData.domain) || profile.preferredUsername !== username)}
						<div>
							{#if !profile.ephemeral?.following}
								<button title="Follow" on:click|preventDefault={handleFollow}>
									<i class="fa-solid fa-user-plus" />
								</button>
							{/if}
							{#if profile.ephemeral?.following !== undefined && profile.ephemeral?.following}
								<button
									title="Unfollow"
									on:click|preventDefault={() => handleUnfollow(profile?.ephemeral?.followActivityAsId)}
								>
									<i class="fa-solid fa-user-minus" />
								</button>
							{/if}
							{#if profile.capabilities && profile.capabilities.enigmatickEncryption}
								<button title="Exchange Keys" on:click|preventDefault={handleKexInit}>
									<i class="fa-solid fa-key" />
								</button>
							{/if}
						</div>
					{/if}
					{#if local && profile.preferredUsername === username}
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
						</div>
					{/if}

					{#if editSummary}
						<div>
							<button title="Cancel" on:click|preventDefault={handleCancel}
								><i class="fa-solid fa-ban" /></button
							>
							<button title="Preview" on:click|preventDefault={handlePreview}
								><i class="fa-solid fa-eye" /></button
							>
							{#if summaryChanged}
								<button on:click|preventDefault={handleSaveSummary} title="Save"
									><i class="fa-solid fa-floppy-disk" /></button
								>
							{/if}
						</div>
					{:else if summaryChanged}
						<div>
							<button on:click|preventDefault={handleSaveSummary} title="Save"
								><i class="fa-solid fa-floppy-disk" /></button
							>
						</div>
					{/if}
				</div>
			{/if}
			<div class="summary">
				{#if editSummary}
					<pre id="summary_edit" contenteditable="true">{summaryMarkdown}</pre>
				{/if}

				{#if username && !editSummary}
					<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
					<!-- svelte-ignore a11y-positive-tabindex -->
					<div>
						{@html insertEmojis(wasm, profile.summary || '', profile)}
					</div>
				{/if}

				{#if !username}
					<span>{@html profile.summary || ''}</span>
				{/if}
			</div>
			<div class="tabs">
				{#if local}
					<button class={currentView === Views.Articles ? 'selected' : ''}>Articles</button>
				{/if}

				{#if local || username}
					<button
						class={currentView === Views.Posts ? 'selected' : ''}
						on:click={() => {
							currentView = Views.Posts;
						}}>Posts</button
					>
				{/if}

				{#if username}
					<button
						class={currentView === Views.Following ? 'selected' : ''}
						on:click={() => {
							currentView = Views.Following;
						}}
						>Following &bull; {abbreviateNumber(
							profile.ephemeral?.leaders || followingCount
						)}</button
					>
					<button
						class={currentView === Views.Followers ? 'selected' : ''}
						on:click={() => {
							currentView = Views.Followers;
						}}
						>Followers &bull; {abbreviateNumber(
							profile.ephemeral?.followers || followerCount
						)}</button
					>
				{/if}
			</div>
		</div>
		<section>
			{#if currentView === Views.Posts}
				<Posts bind:this={postsComponent} handle={$page.params.handle} {local} />
			{:else if currentView == Views.Followers}
				<Follows
					bind:this={followersComponent}
					handle={$page.params.handle}
					{local}
					view="Followers"
					{cache}
					{cachedActor}
				/>
			{:else if currentView == Views.Following}
				<Follows
					bind:this={followingComponent}
					handle={$page.params.handle}
					{local}
					view="Following"
					{cache}
					{cachedActor}
				/>
			{/if}
		</section>
	{/if}
</main>

<style lang="scss">
	:global(.emoji) {
		display: inline;
		max-height: calc(1em - 2px);
		padding: 0;
		margin-bottom: 4px;
		width: auto;
		height: auto;
		vertical-align: middle;
	}

	main {
		grid-area: content;
		width: 100%;
		height: 100%;
		margin: 0;
		font-family: 'Open Sans';
		overflow-y: scroll;
		overflow-x: hidden;

		.profile {
			width: 100%;
			display: flex;
			flex-direction: column;
			max-width: 800px;
			margin: 0 auto;
			background: #fafafa;

			:global(a) {
				color: #777;
			}

			:global(a:hover) {
				color: red;
			}

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

			.tabs {
				display: flex;
				justify-content: center;
				background: inherit;
				container-name: tabs;
				container-type: inline-size;
				overflow-x: auto;

				button {
					color: unset;
					font-size: 1.8cqi;
					padding: 10px 20px;
					white-space: nowrap;
					border-radius: 10px 10px 0 0;
				}

				button:hover {
					background: #dadada;
				}

				button.selected {
					background: #eee;
				}

				@media screen and (max-width: 1000px) {
					button {
						padding: 10px;
						font-size: 2.2cqi;
					}
				}

				@media screen and (max-width: 800px) {
					button {
						padding: 10px;
						font-size: 3cqi;
					}
				}
			}

			.banner {
				z-index: 20;
				width: 100%;
				height: auto;
				max-height: 267px;
				flex-shrink: 0;
				min-height: 80px;
				overflow: hidden;

				img {
					width: 100%;
					height: auto;
				}
			}

			.identity {
				display: flex;
				flex-direction: row;
				width: 100%;
				background: inherit;

				/* percentage margins here are weird because they are relative 
				   to width only, but make sense for this use-case; the square 
				   avatar is 20% wide, and we want it half-way overlapping in 
				   the banner - that means that .details is also shifted by 10% 
				   down to undo the overlap */

				.avatar {
					z-index: 25;
					margin: 0 5%;
					width: 20%;
					height: 20%;
					overflow: none;

					img {
						width: 100%;
						margin-top: -45%;
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

					@media screen and (max-width: 700px) {
						a {
							display: none;
						}
					}
				}
			}

			.controls {
				width: 100%;
				text-align: center;
				background: inherit;

				> div {
					display: inline-block;
					width: unset;
					background: #eee;
					border-radius: 10px;
					padding: 5px;

					button {
						color: #444;

						i {
							color: inherit;
							font-size: 18px;
							padding: 0 5px;
							transition-duration: 500ms;
							pointer-events: none;
						}
					}

					button:hover {
						cursor: pointer;
						color: red;
					}
				}
			}

			.summary {
				position: relative;
				width: 100%;
				background: inherit;
				padding: 5px 20px;

				> pre {
					position: relative;
					margin: 0;
					padding: 5px 20px;
					height: calc(100% - 10px);
					max-height: 40vh;
					width: 100%;
					min-height: 50px;
					background: white;
					word-wrap: break-word;
					white-space: pre-wrap;
					overflow: scroll;
				}

				> pre:focus {
					outline: 1px solid #777;
				}

				> div {
					padding: 0 10px;
				}
				form {
					width: 100%;
				}
			}

			section {
				width: 100%;
				height: 20vh;
				display: block;
			}
		}

		section {
			max-width: 800px;
			margin: 0 auto;
		}
	}

	:global(body.dark) {
		main {
			background: #000;

			.profile {
				background: #1a1a1a;

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

					div {
						background: #333;

						button {
							color: #ddd;
						}

						button:hover {
							color: red;
						}
					}
				}

				.tabs {
					background: inherit;

					button {
						color: #aaa;
					}

					button:hover {
						background: #444;
					}

					button.selected {
						background: #000;
					}
				}

				.summary {
					color: #fff;
					background: inherit;

					:global(p) {
						color: inherit;
					}

					:global(a) {
						color: #aaa;
					}

					:global(a:hover) {
						color: red;
					}

					> pre {
						background: #444;
					}
				}
			}
			section {
				background: #000;
			}
		}
	}
</style>
