<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState } from '../../stores';
	import init_wasm, {
		SendParams,
		send_note,
		get_state as get_wasm_state,
		import_state as import_wasm_state,
		KexInitParams,
		send_kex_init,
		update_keystore_olm_sessions
	} from 'enigmatick_wasm';
	import init_olm, {
		get_state as get_olm_state,
		import_state as import_olm_state,
		create_olm_account,
		get_one_time_keys,
		get_identity_public_key
	} from 'enigmatick_olm';

	function load_enigmatick() {
		init_wasm().then(() => {
			if (get(wasmState)) {
				get_wasm_state().then(() => {
					import_wasm_state(get(wasmState));
					console.log('loaded wasm state from store');
				});
			}
			console.log('init WASM');
		});
	}

	function load_olm() {
		init_olm().then(() => {
			if (get(olmState)) {
				import_olm_state(get(olmState));
				console.log('loaded olm state from store');
			}
			console.log('init OLM');
		});
	}

	onMount(() => {
		load_enigmatick();
		load_olm();
	});

	function handleMessage(event: any) {
		let data = new FormData(event.target);

		console.log(data);

		let note = SendParams.new();

		if (data.get('recipient') && data.get('message')) {
			note.add_address(String(data.get('recipient'))).then(() => {
				note.set_content(String(data.get('message')));
				note.set_kind("Note")

				send_note(note).then(() => {
					console.log('note sent');
				});
			});
		}
	}

	function handleKexInit(event: any) {
		let data = new FormData(event.target);

		console.log(data);

		let kexinit = KexInitParams.new();

		if (data.get('recipient')) {
			kexinit.set_recipient(String(data.get('recipient'))).then(() => {
				kexinit.set_identity_key(String(get_identity_public_key()));

				send_kex_init(kexinit).then(() => {
					console.log('kexinit sent');
				});
			});
		}
	}

	function testHandler(event: any) {
		let x = create_olm_account();
		console.log(x);

		let y = get_one_time_keys();
		console.log(y);
	}
</script>

<form id="message" method="POST" on:submit|preventDefault="{handleMessage}">
	<label>
		Recipient
		<input name="recipient" type="text" />
	</label>

	<label>
		Message
		<textarea name="message" />
	</label>

	<button>Send Message</button>
</form>

<br />

<form id="kexinit" method="POST" on:submit|preventDefault="{handleKexInit}">
	<label>
		Recipient
		<input name="recipient" type="text" />
	</label>

	<button>Send KexInit</button>
</form>

<a href="/login">Login</a>
