<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState } from '../../stores';
	import init_wasm, {
		SendParams,
		send_note,
		get_state,
		import_state,
		create_user
	} from 'enigmatick_wasm';
	import init_olm, {
		create_olm_account,
		get_one_time_keys,
		get_identity_public_key,
		export_account
	} from 'enigmatick_olm';

	function load_enigmatick() {
		init_wasm().then(() => {
			if (get(wasmState)) {
				get_state().then(() => {
					import_state(get(wasmState));
					console.log('loaded state from store');
				});
			}
			console.log('init WASM');
		});
	}

	function load_olm() {
		init_olm().then(() => {
			console.log('init Olm');
		});
	}

	onMount(() => {
		load_enigmatick();
		load_olm();
	});

	function handleSignup(event: any) {
		let data = new FormData(event.target);

		console.log(data);

		let olm_account = create_olm_account();
		let olm_identity_public_key = get_identity_public_key();
		let olm_one_time_keys = get_one_time_keys();
		let updated_olm_account = export_account();

		if (
			data.get('username') &&
			data.get('display_name') &&
			data.get('password') &&
			data.get('passphrase') &&
			olm_identity_public_key &&
			olm_one_time_keys &&
			updated_olm_account
		) {
			create_user(
				String(data.get('username')),
				String(data.get('display_name')),
				String(data.get('password')),
				String(data.get('passphrase')),
				String(olm_identity_public_key),
				String(olm_one_time_keys),
				String(updated_olm_account)
			).then((profile) => {
				console.log(profile);
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

<form id="signup" method="POST" on:submit|preventDefault="{handleSignup}">
	<label>
		Username
		<input name="username" type="text" />
	</label>

	<label>
		Display Name
		<input name="display_name" type="text" />
	</label>

	<label>
		Password
		<input name="password" type="password" />
	</label>

	<label>
		Passphrase
		<input name="passphrase" type="password" />
	</label>

	<button>Create Account</button>
</form>

<a href="/login">Login</a>
