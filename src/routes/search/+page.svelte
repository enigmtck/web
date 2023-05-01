<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { appData, enigmatickWasm, enigmatickOlm } from '../../stores';
	import { getWebFingerFromId, type UserProfile } from '../../common';

	$: wasm = $enigmatickWasm;
	$: olm = $enigmatickOlm;

	let getIdentityPublicKey: any;

	let eventSource: EventSource | null = null;

	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
		}
	});

	onMount(() => {
		eventSource = new EventSource('/api/user/' + username + '/events');
		eventSource.onmessage = (event) => {
			console.log('event: ' + event.data);
			let e: Note | StreamConnect | EnigmatickEvent = JSON.parse(event.data);
			console.log(e);

			if ((<StreamConnect>e).uuid) {
				wasm?.send_authorization((<StreamConnect>e).uuid);
			} else if ((<EnigmatickEvent>e).type) {
				let ev: EnigmatickEvent = <EnigmatickEvent>e;

				if (ev.type == 'Follow' && ev.object !== undefined && String(ev.object) == profile?.id) {
					load_profile();
				} else if (ev.type == 'Accept' && ev.actor && ev.actor == profile?.id) {
					load_profile();
				} else if (
					ev.type == 'Undo' &&
					ev.object &&
					typeof ev.object == 'object' &&
					ev.object.id == profile?.ephemeralLeaderApId
				) {
					load_profile().then(() => {
						console.log('profile loaded');
					});
				}
			}
		};
		return () => {
			if (eventSource && eventSource.readyState === 1) {
				eventSource.close();
			}
		};
	});

	type EnigmatickEventObject = {
		id: string;
	};

	type EnigmatickEvent = {
		'@context': string;
		type: string;
		id?: string;
		actor?: string | null;
		to?: string | null;
		cc?: string | null;
		object?: EnigmatickEventObject | string | null;
	};

	type Tag = {
		type: 'Mention';
		name: string;
		href: string;
	};

	type Attachment = {
		type: 'PropertyValue' | 'Document' | 'IdentityProof';
		name?: string | null;
		value?: string | null;
		mediaType?: string | null;
		url?: string | null;
		blurhash?: string | null;
		width?: number | null;
		height?: number | null;
	};

	type Note = {
		'@context': string;
		type: 'Note';
		tag?: Tag[];
		id?: string;
		actor?: string | null;
		to?: string[];
		cc?: string[];
		url?: string;
		attributedTo: string;
		content?: string | null;
		replies?: object | null;
		published: string | null;
		inReplyTo?: string | null;
		attachment?: Attachment[];
		conversation: string | null;
	};

	type StreamConnect = {
		uuid: string;
	};

	async function load_profile() {
		olm_session = false;
		olm_pending = false;
		one_time_key = false;
		profile = null;

		if (address) {
			const actor = await wasm?.get_actor(address);

			if (actor) {
				profile = JSON.parse(actor);
			}
		}
	}

	async function handleProfile(event: any) {
		let data = new FormData(event.target);
		console.log('looking up: ' + data.get('address'));

		address = String(data.get('address'));

		await load_profile();
	}

	function handleFollow(event: any) {
		if (profile && profile.id) {
			console.log('following: ' + profile.id);

			wasm?.send_follow(profile.id);
		} else {
			console.log('no profile loaded');
		}
	}

	function handleUnfollow(event: any) {
		if (profile && profile.id) {
			console.log('unfollowing: ' + profile.id);

			wasm?.send_unfollow(profile.id);
		} else {
			console.log('no profile loaded');
		}
	}

	async function handleKexInit(event: any) {
		console.log(event);

		let kexinit = wasm?.KexInitParams.new();

		if (wasm && profile && profile.id && kexinit) {
			let a = (await wasm.get_state()).get_olm_pickled_account();
			console.log(a);
			let x = getIdentityPublicKey(String(a));
			console.log('idk');
			console.log(x);
			kexinit.set_recipient_id(profile.id);
			kexinit.set_identity_key(String(x));

			wasm?.send_kex_init(kexinit).then(() => {
				console.log('kexinit sent');
			});
		}
	}

	function handleMessage(event: any) {
		console.log(event);

		if (profile && profile.id) {
			goto(`/message?address=${profile.id}`);
		}
	}

	let olm_session = false;
	let olm_pending = false;
	let one_time_key = false;
	$: address = $page.url.searchParams.get('actor');
	let profile: UserProfile | null = null;
	let username = get(appData).username;
	let display_name = get(appData).display_name;

	$: if (address) {
		load_profile().then(() => {
			console.debug('LOADED');
		});
	}
</script>

<main>
	<form id="profile" method="POST" on:submit|preventDefault={handleProfile}>
		<label>
			<input type="text" id="address" name="address" placeholder="@address@server.url" />
		</label>
	</form>

	{#if profile}
		<div class="profile">
			<div class="banner">
				{#if profile.image}
					<img src={profile.image.url} alt="Banner" />
				{/if}
			</div>

			<div class="identity">
				<div class="avatar">
					{#if profile.icon}
						<img src={profile.icon.url} alt="Avatar" />
					{/if}
				</div>
				<div class="contact">
					<span>{profile.name}</span>
					<a href={getWebFingerFromId(profile)}>{profile.url}</a>
				</div>
			</div>

			<div class="controls">
				<ul>
					{#if !olm_session && !one_time_key && !olm_pending}
						<li><button on:click|preventDefault={handleKexInit}>Exchange Keys</button></li>
					{/if}
					{#if olm_session || one_time_key}
						<li><button on:click|preventDefault={handleMessage}>Message</button></li>
					{/if}
					{#if profile.ephemeralFollowing === undefined}
						<li><button on:click|preventDefault={handleFollow}>Follow</button></li>
					{/if}

					{#if profile.ephemeralFollowing !== undefined && !profile.ephemeralFollowing}
						<li><button>Pending</button></li>
					{/if}

					{#if profile.ephemeralFollowing !== undefined && profile.ephemeralFollowing}
						<li><button on:click|preventDefault={handleUnfollow}>Unfollow</button></li>
					{/if}
				</ul>
			</div>

			<div class="summary">{@html profile.summary}</div>
		</div>
	{/if}
</main>

<style lang="scss">
	* {
		font-family: 'Open Sans';
		transition-duration: 0.5s;
	}

	main {
		display: block;
		max-width: 600px;
		min-width: 400px;
		width: 100%;
		margin: 0 auto;
		grid-area: content;
		padding: 5px 5px 50px 5px;

		label {
			width: 100%;

			input {
				width: 100%;
				padding: 15px;
				border-radius: 15px;
				border: 0;
				outline: 1px solid #ccc;
				font-size: large;
				margin: 10px 0;
			}
		}

		.profile {
			width: 100%;
			padding: 0;
			border: 1px solid #eee;
			border-radius: 0 0 15px 15px;
			background: #fafafa;

			.banner {
				width: 100%;
				max-height: 200px;
				min-height: 70px;
				overflow: hidden;
				background: inherit;

				img {
					width: 100%;
				}
			}

			:global(a) {
				text-decoration: none;
			}

			.identity {
				z-index: 20;
				width: 100%;
				display: flex;
				flex-direction: row;
				background: inherit;

				.avatar {
					z-index: 30;
					margin: 0 5%;
					width: 20%;
					height: 20%;
					overflow: none;

					img {
						margin-top: -50%;
						width: 100%;
						clip-path: inset(0 0 0 0 round 10%);
					}
				}

				span {
					display: inline-block;
					width: 100%;
					font-size: 22px;
					font-weight: 500;
					color: #222;
				}
			}

			.controls {
				width: 100%;
				display: flex;
				flex-direction: column;
				background: inherit;

				ul {
					display: flex;
					flex-direction: row-reverse;
					list-style: none;
					padding: 0;
					margin: 0;
					width: 100%;

					li {
						text-align: right;

						button {
							display: inline-block;
							color: whitesmoke;
							background: darkred;
							transition-duration: 1s;
							border: 0;
							font-size: 18px;
							font-weight: 600;
							padding: 5px 15px;
							margin: 5px;
						}

						button:hover {
							color: darkred;
							background: whitesmoke;
							transition-duration: 1s;
							cursor: pointer;
						}
					}
				}
			}

			.summary {
				margin: 0;
				padding: 10px;
				border-radius: 0 0 15px 15px;
				background: white;

				:global(p) {
					margin: 10px 0;
					color: #000;
				}

				:global(a) {
					color: #444;
				}

				:global(a:hover) {
					color: red;
				}
			}
		}

		@media screen and (max-width: 600px) {
			width: 100vw;
		}
	}

	:global(body.dark) {
		main {
			input {
				background: #222;
				color: white;
				outline: 1px solid #777;
			}
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
