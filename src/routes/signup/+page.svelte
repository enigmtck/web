<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState } from '../../stores';

	let enigmatickWasm: any;
	let createUser: any;

	let enigmatickOlm: any;
	let createOlmAccount: any;
	let getIdentityPublicKey: any;
	let getOneTimeKeys: any;

	onMount(async () => {
		import('enigmatick_wasm').then((enigmatick_wasm) => {
			enigmatick_wasm.default().then(() => {
				enigmatickWasm = enigmatick_wasm;
				createUser = enigmatick_wasm.create_user;

				import('enigmatick_olm').then((enigmatick_olm) => {
					enigmatick_olm.default().then(() => {
						enigmatickOlm = enigmatick_olm;
						createOlmAccount = enigmatick_olm.create_olm_account;
						getIdentityPublicKey = enigmatick_olm.get_identity_public_key;
						getOneTimeKeys = enigmatick_olm.get_one_time_keys;

						if (get(wasmState)) {
							enigmatick_wasm.get_state().then(() => {
								enigmatick_wasm.import_state(get(wasmState));
							});
						}
					});
				});
			});
		});
	});

	async function handleSignup(event: any) {
		let data = new FormData(event.target);

		console.log(data);

		let olm_account = createOlmAccount();
		let olm_identity_public_key = getIdentityPublicKey(olm_account);
		let olm_one_time_keys = getOneTimeKeys(olm_account);

		if (
			data.get('username') &&
			data.get('display_name') &&
			data.get('password') &&
			data.get('passphrase') &&
			olm_identity_public_key &&
			olm_one_time_keys
		) {
			createUser(
				String(data.get('username')),
				String(data.get('display_name')),
				String(data.get('password')),
				String(data.get('passphrase')),
				String(olm_identity_public_key),
				String(olm_one_time_keys.pickled_account)
			).then((profile: any) => {
				console.log(profile);
			});
		}
	}
</script>

<form id="signup" method="POST" on:submit|preventDefault={handleSignup}>
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
