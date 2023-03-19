<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		SendParams,
		send_encrypted_note,
		get_state,
		import_state,
		load_instance_information,
		get_processing_queue,
		get_hash,
		resolve_processed_item,
		store_to_vault,
		decrypt,
		get_sessions,
		get_vault,
		get_actor,
		get_webfinger_from_id
	} from 'enigmatick_wasm';
	import init_olm, {
		decrypt_olm_message,
		create_olm_message,
		get_identity_public_key
	} from 'enigmatick_olm';

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
		tag?: Tag[];
		attachment?: object;
		endpoints?: object;
		icon?: Image;
		image?: Image;
		ephemeralFollowing?: boolean;
		ephemeralLeaderApId?: string;
	};

	onMount(async () => {
		await init_olm();
		let state = await get_state();
		account = state.get_olm_pickled_account();

		if (username && account) {
			const instance = await load_instance_information();
			console.log(instance?.domain);
			console.log(instance?.url);

			if (get(wasmState)) {
				import_state(get(wasmState));
				console.log('loaded state from store');
			}

			get_sessions().then(async (resp) => {
				const sessions: Collection = JSON.parse(String(resp));
				console.info('SESSIONS');
				console.debug(sessions);

				sessions.items?.forEach(async (session) => {
					if ('string' === typeof session.to) {
						let resp = await get_actor(session.to);
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
								session_pickle = decrypt(instrument.content);
							}
						} else if (Array.isArray(session.instrument)) {
							session.instrument.forEach((instrument) => {
								if (instrument.type === 'OlmSession') {
									session_uuid = instrument.uuid;
									session_pickle = decrypt(instrument.content);
								}
							});
						}

						const id = String(session.to);
						established.set(id, [
							id,
							await get_webfinger_from_id(id),
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
		get_processing_queue().then(async (s) => {
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

						const id = queue_item.attributedTo;
						const actor: UserProfile = JSON.parse(String(await get_actor(id)));

						let icon: string | undefined = undefined;
						if (actor.icon && actor.icon.type === 'Image') {
							icon = actor.icon.url;
						}

						if (idk && otk) {
							let message = create_olm_message(id, 'SESSION_INIT', String(account), idk, otk);
							if (message) {
								console.info('SESSION INIT');
								console.info(message.message);
								console.info(message.session);

								const session = message.session;

								let params = (await (await SendParams.new()).add_recipient_id(id, false))
									.set_encrypted()
									.set_identity_key(get_identity_public_key(String(account)))
									.set_session_data(session)
									.set_content(message.message);

								send_encrypted_note(params).then(async () => {
									const item = `${queue_item.id}#processing`;

									resolve_processed_item(item).then(() => {
										console.info(`QUEUE ITEM RESOLVED: ${item}`);
									});

									established.set(id, [
										id,
										await get_webfinger_from_id(id),
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
				} else if (queue_item.type === 'EncryptedNote') {
					console.info('ENCRYPTED NOTE');
					if (queue_item.tag) {
						let idk: string | null = null;

						queue_item.tag.forEach((t) => {
							const tag = <Tag>t;

							if (tag.type === 'Mention') {
								if (tag.name === queue_item.attributedTo) {
									idk = tag.value;
								}
							}
						});

						if (idk) {
							let session: string | undefined = undefined;
							let session_uuid: string | undefined = undefined;

							const id = queue_item.attributedTo;
							const actor: UserProfile = JSON.parse(String(await get_actor(id)));

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
								session = decrypt(instrument.content);
								session_uuid = instrument.uuid;
							}

							const message = decrypt_olm_message(
								queue_item.attributedTo,
								queue_item.content,
								String(account),
								String(idk),
								session
							);

							if (message) {
								console.info(`MESSAGE: ${message.message}`);

								if (message.message === 'SESSION_INIT') {
									const ack = create_olm_message(
										queue_item.attributedTo,
										'SESSION_ACK',
										String(account),
										idk,
										undefined,
										message.session
									);

									if (ack) {
										const params = (
											await (
												await SendParams.new()
											).add_recipient_id(queue_item.attributedTo, false)
										)
											.set_encrypted()
											.set_identity_key(get_identity_public_key(String(account)))
											.set_session_data(ack.session)
											.set_session_uuid(session_uuid)
											.set_content(ack.message)
											.resolves(`${queue_item.id}#processing`);

										send_encrypted_note(params).then(() => {
											console.info('SESSION ACK SENT');
										});
									}
								} else {
									// send it to the vault
									const vault_data = JSON.stringify({
										message: message.message,
										published: queue_item.published
									});

									store_to_vault(
										vault_data,
										queue_item.attributedTo,
										`${queue_item.id}#processing`,
										String(session_uuid),
										message.session,
										String(get_hash(String(session)))
									).then(async () => {
										established.set(id, [
											id,
											await get_webfinger_from_id(id),
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

	type OlmSessionResponse = {
		session_pickle: string;
		uuid: string;
	};

	type Tag = {
		type: 'Mention' | 'Emoji' | 'Hashtag';
		href: string | null;
		name: string | null;
		value: string | null;
	};

	type Instrument = {
		type: 'IdentityKey' | 'SessionKey' | 'OlmSession';
		content: string;
		hash?: string;
		uuid?: string;
	};

	type QueueItem = {
		'@context'?: string | null;
		attributedTo: string;
		id: string;
		tag?: object[];
		type: 'EncryptedNote' | 'EncryptedSession' | 'VaultNote';
		to: string[] | string;
		published: string;
		content: string;
		conversations?: string;
		instrument?: Instrument[] | Instrument | undefined;
	};

	type Collection = {
		'@context': string;
		type: 'Collection' | 'OrderedCollection';
		id: string;
		totalItems: number;
		items?: QueueItem[];
		orderedItems?: QueueItem[];
	};

	async function handleMessage(event: any) {
		let data = new FormData(event.target);
		const message = data.get('message');

		console.log(data);

		if (selected) {
			const cached = established.get(selected);

			if (cached) {
				const [id, webfinger, name, image, session_uuid, session_pickle] = cached;
				// write code to check for existing session
				if (session_pickle) {
					const encrypted = create_olm_message(
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

						const params = (await (await SendParams.new()).add_recipient_id(selected, false))
							.set_encrypted()
							.set_identity_key(get_identity_public_key(String(account)))
							.set_session_data(encrypted.session)
							.set_session_uuid(session_uuid)
							.set_content(encrypted.message);

						send_encrypted_note(params).then(() => {
							console.log('NOTE SENT');
						});
					}
				}
			}
		}
	}

	type VaultedMessage = {
		message: string;
		published: string;
		attributedTo?: string;
	};

	async function selectSession(event: any) {
		selected = event.target.dataset.recipient;

		let vaultStr = await get_vault(0, 40, String(selected));
		console.log(`SELECTED: ${selected}`);
		console.log(`VAULT: ${vaultStr}`);
		messages = [];

		if (vaultStr) {
			let vaultItems: Collection = JSON.parse(vaultStr);
			console.info(vaultItems);

			vaultItems.orderedItems?.forEach((item) => {
				let message: VaultedMessage = JSON.parse(String(decrypt(item.content)));
				get_webfinger_from_id(item.attributedTo).then((x) => {
					message.attributedTo = x;
					messages.push(message);

					messages = messages;
				});
			});
		}
	}
	// id -> [id, webfinger, display_name, image_url, session_uuid, session_pickle]
	let established = new Map<string, any[]>();

	let selected: string | null = null;
	let username = get(appData).username;
	let account: string | undefined = undefined;

	let messages: VaultedMessage[] = [];
</script>

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
	main {
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
