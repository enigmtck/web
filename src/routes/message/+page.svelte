<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		SendParams,
		send_encrypted_note,
		get_state as get_wasm_state,
		import_state as import_wasm_state,
		KexInitParams,
		send_kex_init,
		load_instance_information,
		update_keystore_olm_sessions,
		get_external_one_time_key,
		get_external_identity_key,
		get_processing_queue
	} from 'enigmatick_wasm';
	import init_olm, {
		create_olm_account,
		decrypt_olm_message,
		get_one_time_keys,
		create_olm_message,
		get_identity_public_key
	} from 'enigmatick_olm';

	function load_enigmatick() {
		init_olm().then(() => {
			console.log('init OLM');
		});
	}

	onMount(async () => {
		load_enigmatick();

		if (username) {
			const instance = await load_instance_information();
			console.log(instance?.domain);
			console.log(instance?.url);

			if (get(wasmState)) {
				import_wasm_state(get(wasmState));
				console.log('loaded state from store');
			}

			console.log('init WASM');

			get_processing_queue().then(async (x) => {
				console.log('queue');
				const q: Collection = JSON.parse(String(x));

				q.items.forEach(async (x) => {
					let k = get_external_identity_key(x.attributedTo);
					console.log(k);
					let a = (await get_wasm_state()).get_olm_pickled_account;
					let d = decrypt_olm_message(x.attributedTo, x.content, String(a), String(k));
					console.log(d);
				});
				console.log(q);
			});
		}
	});

	type QueueItem = {
		'@context'?: string | null;
		attributedTo: string;
		id: string;
		tag?: object[];
		type: 'EncryptedNote';
		to: string[];
		published: string;
		content: string;
		conversations: string;
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
			const otk = get_external_one_time_key(address);
			const idk = get_external_identity_key(address);

			if (idk && otk) {
				const encrypted = create_olm_message(address, String(message), idk, otk);
				console.log(`encrypted\n${encrypted}`);

				if (encrypted) {
					let note = SendParams.new();
					note = await note.add_recipient_id(address, false);
					note = note.set_content(encrypted.message);
					// write code to include the session and maybe? remote_actor
					note = note.set_kind('EncryptedNote');

					send_encrypted_note(note).then(() => {
						console.log('note sent');
					});
				}
			}
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
