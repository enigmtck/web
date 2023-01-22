<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		authenticate,
		SendParams,
		send_note,
		send_encrypted_note,
		get_actor,
		get_inbox,
		get_processing_queue,
		get_external_identity_key,
		init_sse,
		update_keystore_olm_sessions,
		load_instance_information,
		send_follow,
		send_unfollow,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state,
		create_olm_message,
		decrypt_olm_message
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
		mediaType?: string;
		type: string;
		url: string;
	};

	type UserProfile = {
		'@context': string;
		type: string;
		name?: string;
		summary?: string;
		id?: string;
		preferredUsername: string;
		inbox: string;
		outbox: string;
		followers: string;
		following: string;
		liked?: string;
		publicKey: object;
		featured?: string;
		featuredTags?: string;
		url?: string;
		manuallyApprovesFollowers?: boolean;
		published?: string;
		tag?: object;
		attachment?: object;
		endpoints?: object;
		icon?: Image;
		image?: Image;
		ephemeralFollowing?: boolean;
		ephemeralLeaderApId?: string;
	};

	let profile: UserProfile | null = null;

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

	onMount(() => {
		load_enigmatick();

		if (username) {
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

			const sse = new EventSource('/api/user/' + username + '/events');
			sse.onmessage = (event) => {
				console.log('event: ' + event.data);
				let e: EnigmatickEvent = JSON.parse(event.data);

				if (e.type == 'Follow' && e.object !== undefined && String(e.object) == profile?.id) {
					load_profile();
				} else if (e.type == 'Accept' && e.actor && e.actor == profile?.id) {
					load_profile();
				} else if (
					e.type == 'Undo' &&
					e.object &&
					typeof e.object == 'object' &&
					e.object.id == profile?.ephemeralLeaderApId
				) {
					load_profile();
				}
			};
			return () => {
				if (sse.readyState === 1) {
					sse.close();
				}
			};
		} else {
			goto('/');
		}
	});

	let address: string | null = null;

	function load_profile() {
		if (address) {
			get_actor(address).then((actor) => {
				if (actor) {
					profile = JSON.parse(actor);
					console.log(profile);
				}
			});
		}
	}

	function handleProfile(event: any) {
		let data = new FormData(event.target);
		console.log('looking up: ' + data.get('address'));

		address = String(data.get('address'));

		load_profile();
	}

	function handleFollow(event: any) {
		if (profile && profile.id) {
			console.log('following: ' + profile.id);

			send_follow(profile.id);
		} else {
            console.log('no profile loaded')
        }
	}

    function handleUnfollow(event: any) {
		if (profile && profile.id) {
			console.log('unfollowing: ' + profile.id);

			send_unfollow(profile.id);
		} else {
            console.log('no profile loaded')
        }
	}

	let username = get(appData).username;
	let display_name = get(appData).display_name;
</script>

<svelte:head>
	<style>
		body {
			display: flex;
			flex-direction: column;
		}
	</style>
</svelte:head>

<header>
	<div>
		<span class="title"><a href="/">ENIGMATICK</a></span>
	</div>

	{#if display_name}
		<nav>
			<span class="person"><a href="/@{username}">{display_name}</a></span>
		</nav>
	{/if}
</header>

<main>
	<form id="profile" method="POST" on:submit|preventDefault={handleProfile}>
		<label>
			<input type="text" id="address" name="address" placeholder="@address@server.url" />
		</label>
	</form>

	{#if profile}
		<div class="profile">
			{#if profile.image}
				<img src={profile.image.url} alt="Banner" />
			{/if}

			<div class="identity">
				{#if profile.icon}
					<img src={profile.icon.url} alt="Avatar" />
				{/if}
				<div class="controls">
					<a href={profile.url}>{profile.name}</a>
					<ul>
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
			</div>

			<div class="summary">{@html profile.summary}</div>
		</div>
	{/if}
</main>

<style lang="scss">
	:global(a),
	:global(a:visited) {
		color: #222;
		text-decoration: none;
	}

	:global(a:hover) {
		color: red;
		transition-duration: 0.5s;
		text-decoration: none;
	}

	* {
		font-family: 'Open Sans';
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
		height: auto;

		a {
			color: #eee;
			text-decoration: none;
		}

		a:visited {
			color: #eee;
		}

		nav {
			display: block;
			position: fixed;
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
		max-width: 500px;
		width: 100%;
		margin: 0 auto 0 auto;
		padding: 5px;

		input {
			width: 100%;
			padding: 15px;
			border-radius: 15px;
			border: 0;
			outline: 1px solid #ccc;
			font-size: large;
			margin: 10px 0;
		}

		.profile {
			width: 100%;
			padding: 0;
			border: 1px solid #eee;
			border-radius: 15px;

			img {
				width: 100%;
				height: 150px;
				clip-path: inset(0 0 0 0 round 15px 15px 0 0);
				margin-bottom: -30px;
			}

			.identity {
				padding: 10px;
				width: 100%;
				display: flex;
				flex-direction: row;

				filter: drop-shadow(10px 10px 4px #ddd);

				img {
					width: 150px;
					height: 150px;
					clip-path: inset(0 0 0 0 round 15px);
				}

				.controls {
					width: calc(100% - 150px);
					margin-top: 20px;
					display: flex;
					flex-direction: column;

					a {
						display: block;
						width: 100%;
						font-size: 28px;
						padding: 0 20px;
					}

					ul {
						display: inline-block;
						list-style: none;
						padding: 5px;
						width: 100%;

						li {
							text-align: center;

							button {
								display: inline-block;
								color: darkred;
								background: white;
								border: 2px solid darkred;
								font-size: 18px;
								font-weight: 600;
								padding: 5px 15px;
								margin: 5px;
								border-radius: 5px;
							}

							button:hover {
								color: white;
								background: darkred;
								transition-duration: 1s;
								cursor: pointer;
							}
						}
					}
				}
			}

			.summary {
				margin: 5px 0 0 0;
				padding: 5px 10px;
			}
		}
	}
</style>
