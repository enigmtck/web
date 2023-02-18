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
		KexInitParams,
		send_kex_init,
		load_instance_information,
		get_processing_queue,
		get_session,
		get_hash,
		resolve_processed_item,
		store_to_vault
	} from 'enigmatick_wasm';
	import init_olm, {
		create_olm_account,
		decrypt_olm_message,
		get_one_time_keys,
		create_olm_message,
		get_identity_public_key
	} from 'enigmatick_olm';

	onMount(async () => {
		await init_olm();
		let state = await get_state();
		let pickled_account = state.get_olm_pickled_account();

		if (username && pickled_account) {
			const instance = await load_instance_information();
			console.log(instance?.domain);
			console.log(instance?.url);

			if (get(wasmState)) {
				import_state(get(wasmState));
				console.log('loaded state from store');
			}

			console.log('init WASM');

			get_processing_queue().then(async (s) => {
				console.info('QUEUE');
				console.debug(s);
				const q: Collection = JSON.parse(String(s));
				console.log(q);

				q.items.forEach(async (x) => {
					if (x.type === 'EncryptedSession') {
						console.info('ENCRYPTED SESSION');

						let idk: string | null = null;
						let otk: string | null = null;
						if (x.instrument) {
							x.instrument.forEach((y) => {
								console.info(`TYPE ${y.type}, CONTENT ${y.content}`);
								if (y.type === 'IdentityKey') {
									idk = y.content;
								} else if (y.type === 'SessionKey') {
									otk = y.content;
								}
							});

							if (idk && otk) {
								let message = create_olm_message(
									x.attributedTo,
									'SESSION_INIT',
									String(pickled_account),
									idk,
									otk
								);
								if (message) {
									console.info('SESSION INIT');
									console.info(message.message);
									console.info(message.session);

									let params = (
										await (await SendParams.new()).add_recipient_id(x.attributedTo, false)
									)
										.set_encrypted()
										.set_identity_key(get_identity_public_key(String(pickled_account)))
										.set_session_data(message.session)
										.set_content(message.message);

									send_encrypted_note(params).then(() => {
										const item = `${x.id}#processing`;

										resolve_processed_item(item).then(() => {
											console.info(`QUEUE ITEM RESOLVED: ${item}`);
										});
										console.info('SESSION INIT SENT');
									});
								}
							}
						}
					} else if (x.type === 'EncryptedNote') {
						console.info('ENCRYPTED NOTE');
						if (x.tag) {
							let idk: string | null = null;

							x.tag.forEach((t) => {
								const tag = <Tag>t;

								if (tag.type === 'Mention') {
									if (tag.name === x.attributedTo) {
										idk = tag.value;
									}
								}
							});

							if (idk) {
								const account = (await get_state()).get_olm_pickled_account();
								const stored_session_json = await get_session(x.attributedTo);

								console.warn(stored_session_json);

								let session: string | undefined = undefined;
								let session_uuid: string | undefined = undefined;
								let encrypted_session_id: string | undefined = undefined;

								if (stored_session_json) {
									const stored_session: OlmSessionResponse = JSON.parse(stored_session_json);
									console.warn(stored_session);
									session = stored_session.session_pickle;
									session_uuid = stored_session.uuid;
								}

								const message = decrypt_olm_message(
									x.attributedTo,
									x.content,
									String(account),
									String(idk),
									session
								);

								if (message) {
									console.info(`MESSAGE: ${message.message}`);

									if (message.message === 'SESSION_INIT') {
										const ack = create_olm_message(
											x.attributedTo,
											'SESSION_ACK',
											String(pickled_account),
											idk,
											undefined,
											message.session
										);

										if (ack) {
											const params = (
												await (await SendParams.new()).add_recipient_id(x.attributedTo, false)
											)
												.set_encrypted()
												.set_identity_key(get_identity_public_key(String(pickled_account)))
												.set_session_data(ack.session)
												.set_content(ack.message)
												.resolves(`${x.id}#processing`);

											send_encrypted_note(params).then(() => {
												console.info('SESSION ACK SENT');
											});
										}
									} else {
										// send it to the vault
										const vault_data = JSON.stringify({'message': message.message, 'published': x.published});

										store_to_vault(
											vault_data,
											x.attributedTo,
											`${x.id}#processing`,
											String(session_uuid),
											message.session,
											String(get_hash(String(session)))
										).then(() => {
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
	});

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
		type: 'IdentityKey' | 'SessionKey';
		content: string;
	};

	type QueueItem = {
		'@context'?: string | null;
		attributedTo: string;
		id: string;
		tag?: object[];
		type: 'EncryptedNote' | 'EncryptedSession';
		to: string[];
		published: string;
		content: string;
		conversations: string;
		instrument?: Instrument[];
	};

	type Collection = {
		'@context': string;
		type: 'Collection' | 'OrderedCollection';
		id: string;
		totalItems: number;
		items: QueueItem[];
	};

	async function handleMessage(event: any) {
		let data = new FormData(event.target);
		const message = data.get('message');

		console.log(data);

		// write code to check for existing session
		if (message && address) {
			// we're going to do this differently by assuming that a session already exists and retrieving that 

			/* const otk = get_external_one_time_key(address);
			const idk = get_external_identity_key(address);

			if (idk && otk) {
				const encrypted = create_olm_message(address, String(message), idk, otk);
				console.log(`encrypted\n${encrypted}`);

				if (encrypted) {
					let note = await SendParams.new();
					note = await note.add_recipient_id(address, false);
					note = note.set_content(encrypted.message);
					// write code to include the session and maybe? remote_actor
					note = note.set_encrypted();

					send_encrypted_note(note).then(() => {
						console.log('note sent');
					});
				}
			} */
		}
	}

	let username = get(appData).username;
	let address: string | null = $page.url.searchParams.get('address');
</script>

<main>
	<form id="message" method="POST" on:submit|preventDefault={handleMessage}>
		<label>
			Message
			<textarea name="message" />
		</label>

		<button>Send Message</button>
	</form>
</main>
