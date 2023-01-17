<script lang="ts">

    import { page } from '$app/stores';
    console.log($page.params)

	import { onMount, setContext } from 'svelte'
	import { get } from 'svelte/store'
	import { wasmState, olmState, appData } from '../../stores'
	import init_wasm, {
		authenticate,
		SendParams,
		send_note,
		send_encrypted_note,
		get_inbox,
		get_processing_queue,
		get_external_identity_key,
		init_sse,
		update_keystore_olm_sessions,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm'
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state,
		create_olm_message,
		decrypt_olm_message
	} from 'enigmatick_olm'
	import { identity } from 'svelte/internal';

	function load_enigmatick() {
		init_wasm().then(() => {
			if (get(wasmState)) {
				get_wasm_state().then(() => {
					import_wasm_state(get(wasmState))
					console.log('loaded state from store')
				})
			}
			console.log('init WASM')
		})

		init_olm().then(() => {
			if (get(olmState)) {
				import_olm_state(get(olmState))
				console.log('loaded olm state from store')
			}
			console.log('init OLM')
		})
	}

	onMount(() => {
		load_enigmatick()

        fetch('/user/' + $page.params.handle).then((x) => {
            x.json().then((y) => {
                console.log(y)
            })
        })
		/* const sse = new EventSource("/events")
		sse.onmessage = (event) => {
			//console.log("event: " + event.data)
		}

		return () => {
			if(sse.readyState === 1) {
				sse.close();
			}
		} */
	})

	let username = get(appData).username
</script>

{#if username}
<div>{username}</div>
{/if}
