<script lang="ts">
	import { page } from '$app/stores';

	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { appData, enigmatickWasm } from '../../stores';
	import type { UserProfile, VaultedMessage, Instrument, Collection, Tag } from '../../common';
	import { getWebFingerFromId } from '../../common';

	$: wasm = $enigmatickWasm;
	$: username = get(appData).username;
	let account: any;

	onMount(async () => {
		console.debug(wasm);
		console.debug(username);
		if (wasm && username) {
			if (wasm) {
				let state = wasm.get_state();
				account = state.get_olm_pickled_account();
				wasm.get_followers().then((x) => {
					if (x) {
						const followers: UserProfile[] = JSON.parse(x);
						followers.forEach((actor) => {
							if (actor.id) {
								actors.set(actor.id, actor);
							}
						});
						console.debug(actors);
						actors = actors;
					}
				});

				wasm.get_following().then((x) => {
					if (x) {
						const following: UserProfile[] = JSON.parse(x);
						following.forEach((actor) => {
							if (actor.id) {
								actors.set(actor.id, actor);
							}
						});
						console.debug(actors);
						actors = actors;
					}
				});
			}

			wasm.get_sessions().then(async (resp) => {
				const sessions: Collection = JSON.parse(String(resp));
				console.info('SESSIONS');
				console.debug(sessions);

				sessions.items?.forEach(async (session) => {
					if ('string' === typeof session.to) {
						let resp = await wasm?.get_actor(session.to);
						const actor: UserProfile = JSON.parse(String(resp));

						let icon = undefined;
						if (actor.icon && actor.icon.type === 'Image') {
							icon = actor.icon.url;
						}

						let session_pickle = undefined;
						let session_uuid = undefined;

						const instrument = <Instrument>session.instrument;
						if (instrument.content) {
							if (instrument.type === 'OlmSession') {
								session_uuid = instrument.uuid;
								session_pickle = wasm?.decrypt(instrument.content);
							}
						} else if (Array.isArray(session.instrument)) {
							session.instrument.forEach((instrument) => {
								if (instrument.type === 'OlmSession') {
									session_uuid = instrument.uuid;
									session_pickle = wasm?.decrypt(instrument.content);
								}
							});
						}

						const id = String(session.to);
						established.set(id, [
							id,
							await wasm?.get_webfinger_from_id(id),
							actor.name,
							icon,
							session_uuid,
							session_pickle
						]);
						established = established;
					}
				});

				console.info(established);
			});

			processQueue();
		}
	});

	function processQueue() {
		wasm?.get_processing_queue().then(async (s) => {
			console.info('QUEUE');
			console.debug(s);
			const queue: Collection = JSON.parse(String(s));
			console.log(queue);

			queue.items?.forEach(async (queue_item) => {
				if (queue_item.type === 'EncryptedSession') {
					console.info('ENCRYPTED SESSION');

					let idk: string | null = null;
					let otk: string | null = null;
					if (queue_item.instrument && (<Instrument[]>queue_item.instrument).forEach) {
						(<Instrument[]>queue_item.instrument).forEach((instrument) => {
							console.info(`TYPE ${instrument.type}, CONTENT ${instrument.content}`);
							if (instrument.type === 'IdentityKey') {
								idk = instrument.content;
							} else if (instrument.type === 'SessionKey') {
								otk = instrument.content;
							}
						});

						const id: string = <string>queue_item.attributedTo;
						const actor: UserProfile = JSON.parse(String(await wasm?.get_actor(id)));

						let icon: string | undefined = undefined;
						if (actor.icon && actor.icon.type === 'Image') {
							icon = actor.icon.url;
						}

						if (idk && otk) {
							let message = wasm?.create_olm_message(id, 'SESSION_INIT', String(account), idk, otk);
							if (message) {
								console.info('SESSION INIT');
								console.info(message.message);
								console.info(message.session);

								const session = message.session;

								if (wasm) {
									let params = (await (await wasm.SendParams.new()).add_recipient_id(id, false))
										.set_encrypted()
										.set_identity_key(wasm.get_identity_public_key(String(account)))
										.set_session_data(session)
										.set_content(message.message);

									wasm.send_encrypted_note(params).then(async () => {
										const item = `${queue_item.id}#processing`;

										wasm?.resolve_processed_item(item).then(() => {
											console.info(`QUEUE ITEM RESOLVED: ${item}`);
										});

										established.set(id, [
											id,
											await wasm?.get_webfinger_from_id(id),
											actor.name,
											icon,
											undefined,
											session
										]);
										console.info('SESSION INIT SENT');
									});
								}
							}
						}
					}
				} else if (queue_item.type === 'EncryptedNote') {
					console.info('ENCRYPTED NOTE');
					if (queue_item.tag) {
						let idk: string | null = null;

						queue_item.tag.forEach((t) => {
							const tag = <Tag>t;

							if (tag.type === 'Mention') {
								if (tag.name === queue_item.attributedTo && tag.value) {
									idk = tag.value;
								}
							}
						});

						if (wasm && idk) {
							let session: string | undefined = undefined;
							let session_uuid: string | undefined = undefined;

							const id = <string>queue_item.attributedTo;
							const actor: UserProfile = JSON.parse(String(await wasm.get_actor(id)));

							let icon: string | undefined = undefined;
							if (actor.icon && actor.icon.type === 'Image') {
								icon = actor.icon.url;
							}

							if (
								queue_item.instrument &&
								(<Instrument>queue_item.instrument).type == 'OlmSession'
							) {
								const instrument: Instrument = <Instrument>queue_item.instrument;
								console.warn(instrument);
								session = wasm.decrypt(instrument.content);
								session_uuid = instrument.uuid;
							}

							const message = wasm.decrypt_olm_message(
								<string>queue_item.attributedTo,
								<string>queue_item.content,
								String(account),
								String(idk),
								session
							);

							if (message) {
								console.info(`MESSAGE: ${message.message}`);

								if (message.message === 'SESSION_INIT') {
									const ack = wasm.create_olm_message(
										<string>queue_item.attributedTo,
										'SESSION_ACK',
										String(account),
										idk,
										undefined,
										message.session
									);

									if (ack) {
										const params = (
											await (
												await wasm.SendParams.new()
											).add_recipient_id(<string>queue_item.attributedTo, false)
										)
											.set_encrypted()
											.set_identity_key(wasm.get_identity_public_key(String(account)))
											.set_session_data(ack.session)
											.set_session_uuid(session_uuid)
											.set_content(ack.message)
											.resolves(`${queue_item.id}#processing`);

										wasm.send_encrypted_note(params).then(() => {
											console.info('SESSION ACK SENT');
										});
									}
								} else {
									// send it to the vault
									const vault_data = JSON.stringify({
										message: message.message,
										published: queue_item.published
									});

									wasm
										.store_to_vault(
											vault_data,
											<string>queue_item.attributedTo,
											`${queue_item.id}#processing`,
											String(session_uuid),
											message.session,
											String(wasm.get_hash(new TextEncoder().encode(String(session))))
										)
										.then(async () => {
											established.set(id, [
												id,
												await wasm?.get_webfinger_from_id(id),
												actor.name,
												icon,
												session_uuid,
												message.session
											]);
											console.info('STORED TO VAULT');
										});
								}
							}
						}
					}
				}
			});
		});
	}

	async function handleMessage(event: any) {
		let data = new FormData(event.target);
		const message = data.get('message');

		console.log(data);

		if (selected) {
			const cached = established.get(selected);

			if (wasm && cached) {
				const [id, webfinger, name, image, session_uuid, session_pickle] = cached;
				// write code to check for existing session
				if (session_pickle) {
					const encrypted = wasm.create_olm_message(
						selected,
						String(message),
						String(account),
						undefined,
						undefined,
						session_pickle
					);
					console.debug(encrypted);

					if (encrypted) {
						console.info('ENCRYPTED');
						console.debug(encrypted.message);

						const params = (await (await wasm.SendParams.new()).add_recipient_id(selected, false))
							.set_encrypted()
							.set_identity_key(wasm.get_identity_public_key(String(account)))
							.set_session_data(encrypted.session)
							.set_session_uuid(session_uuid)
							.set_content(encrypted.message);

						wasm.send_encrypted_note(params).then(() => {
							console.log('NOTE SENT');
						});
					}
				}
			}
		}
	}

	async function selectSession(event: any) {
		selected = event.target.dataset.recipient;

		let vaultStr = await wasm?.get_vault(0, 40, String(selected));
		console.log(`SELECTED: ${selected}`);
		console.log(`VAULT: ${vaultStr}`);
		messages = [];

		if (vaultStr) {
			let vaultItems: Collection = JSON.parse(vaultStr);
			console.info(vaultItems);

			vaultItems.orderedItems?.forEach((item) => {
				let message: VaultedMessage = JSON.parse(String(wasm?.decrypt(<string>item.content)));
				wasm?.get_webfinger_from_id(<string>item.attributedTo).then((x) => {
					message.attributedTo = x;
					messages.push(message);

					messages = messages;
				});
			});
		}
	}

	function compare(a: UserProfile, b: UserProfile) {
		if (a.preferredUsername.toLowerCase() < b.preferredUsername.toLowerCase()) {
			return -1;
		} else if (a.preferredUsername.toLowerCase() > b.preferredUsername.toLowerCase()) {
			return 1;
		} else {
			return 0;
		}
	}

	// id -> [id, webfinger, display_name, image_url, session_uuid, session_pickle]
	let established = new Map<string, any[]>();

	let selected: string | null = null;

	let messages: VaultedMessage[] = [];

	let actors = new Map<string, UserProfile>();
</script>

<div class="contacts">
	<ul>
		{#each Array.from(actors.values()).sort(compare) as actor}
			<li>
				<div>
					<img src={actor.icon?.url} alt="Profile" />
				</div>
				<div>
					<span>{actor.name}</span>
					<span>{getWebFingerFromId(actor)}</span>
				</div>
			</li>
		{/each}
	</ul>
</div>

<main>
	<button on:click|preventDefault={processQueue}>Process Queue</button>

	<ul>
		{#each Array.from(established.values()) as [id, webfinger, name, image, uuid, session]}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<li data-recipient={id} on:click|preventDefault={selectSession}>
				<div><img alt="Profile" src={image} /></div>
				<div>
					<span>{name}</span>
					<span>{webfinger}</span>
				</div>
			</li>
		{/each}
	</ul>

	{#if selected}
		<form id="message" method="POST" on:submit|preventDefault={handleMessage}>
			<label>
				Message
				<textarea name="message" />
			</label>

			<button>Send Message</button>
		</form>
	{/if}

	<ul>
		{#each messages as message}
			<li>
				<span>{message.attributedTo}</span>
				<span>{message.published}</span>
				<span>{message.message}</span>
			</li>
		{/each}
	</ul>
</main>

<style lang="scss">
	.contacts {
		display: block;
		grid-area: left-aside;
		background: #fafafa;
		height: calc(100vh - 41px);
		overflow: scroll;

		ul {
			display: block;
			height: 100%;
			padding: 10px;
			margin: 0;

			li {
				list-style: none;
				padding: 0;
				margin: 0 0 10px 0;
				width: 100%;
				display: flex;
				flex-direction: row;
				max-width: 350px;
				overflow: hidden;

				div {
					height: 55px;

					img {
						height: 100%;
						width: auto;
						clip-path: inset(0 0 0 0 round 50%);
					}

					span {
						display: inline-block;
						padding: 0 0 2px 5px;
						width: 100%;
						font-family: 'Open Sans';
						font-size: 13px;
					}

					span:first-child {
						font-size: 15px;
						font-weight: 600;
					}
				}
			}
		}
	}

	main {
		grid-area: content;
		min-width: 400px;
		ul {
			margin: 0;
			padding: 0;
			list-style: none;

			li {
				display: flex;
				flex-direction: row;

				div:first-child {
					width: 55px;
					pointer-events: none;
					:global(img) {
						width: 100%;
						height: unset;
						clip-path: inset(0 0 0 0 round 20%);
					}
				}

				div {
					width: calc(100% - 55px);
					display: flex;
					flex-direction: column;
					pointer-events: none;

					span {
						font-family: 'Open Sans';
						display: inline-block;
						width: 100%;
						pointer-events: none;
					}

					span:first-child {
						font-weight: 600;
						font-size: 18px;
					}
				}
			}
		}
	}
</style>
