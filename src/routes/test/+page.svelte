<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, appData, enigmatickWasm } from '../../stores';
	import init_wasm, {
		OtkUpdateParams,
		add_one_time_keys,
		get_hash,
		authenticate,
		SendParams,
		send_note,
		get_inbox,
		get_processing_queue,
		upload_avatar,
		load_instance_information,
		get_state,
		import_state as import_wasm_state,
		create_olm_message,
		decrypt_olm_message,
		test
	} from 'enigmatick_wasm';

	$: wasm = $enigmatickWasm;

	let username = get(appData).username;

	onMount(() => {});

	async function handleTest() {
		await wasm?.test();
	}
</script>

<div>
	<input type="button" on:click={handleTest} value="Click Me" />
</div>
