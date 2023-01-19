<script lang="ts">

    import { page } from '$app/stores';

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

	type UserProfile = {
		"@context": string
		type: string
		name: string
		summary: string
		id: string
		preferredUsername: string
		inbox: string
		outbox: string
		followers: string
		following: string
		liked: string
		publicKey: object
	}

	let profile: UserProfile | null =  null;

	onMount(() => {
		load_enigmatick()
	})

    function handleProfile(event: any) {
		let data = new FormData(event.target)
        console.log("looking up: " + data.get('address'))
    }

	let username = get(appData).username
</script>

<div class="page">
    <div class="component">
        <form id="login" method="POST" on:submit|preventDefault={handleProfile}>
            <label>
                <input type="text" id="address" name="address" placeholder="@address@server.url"/>
            </label>
        </form>
    </div>
</div>

<style>
    .page {
        display: block;
        width: 100%;
    }

    .component {
        display: block;
        width: 500px;
        margin: 0 auto 0 auto;
    }

    input {
        width: 100%;
        padding: 15px;
        border-radius: 10px;
        border: 0;
        outline: 1px solid #CCC;
        font-size: large;
    }
</style>