<script lang="ts">
	import { page } from '$app/stores';

	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		load_instance_information,
		upload_avatar,
		upload_banner,
        update_password,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state
	} from 'enigmatick_olm';

	function load_enigmatick() {
		init_olm().then(() => {
			if (get(olmState)) {
				import_olm_state(get(olmState));
				console.log('loaded olm state from store');
			}
			console.log('init OLM');
		});
	}

	let username = get(appData).username;
	let display_name = get(appData).display_name;

	onMount(() => {
		load_enigmatick();

		if (username) {
			init_wasm().then(() => {
				load_instance_information().then((instance) => {
					console.log(instance?.domain);
					console.log(instance?.url);

					if (get(wasmState)) {
						get_wasm_state().then(() => {
							import_wasm_state(get(wasmState));
							console.log('loaded state from store');
						});
					}
					console.log('init WASM');
				});
			});
		}
	});

	function handlePasswordChange(event: any) {
        let data = new FormData(event.target);

        let current = data.get("current_password");
        let updated = data.get("new_password");
        let confirm = data.get("confirm_password");

        if (current && updated && confirm && updated === confirm) {
            console.log(current + " " + updated + " " + confirm);

            update_password(String(current), String(updated)).then((x) => {
                if (x) {
                    console.log("update successful")
                } else {
                    console.log("update failed")
                }
            })
        }
    }
</script>

<main>
	<form id="change_password" method="POST" on:submit|preventDefault={handlePasswordChange}>
        <h3>Change Password</h3>
		<label>
			Current Password
			<input name="current_password" type="password" placeholder="Authentication" />
		</label>

		<label>
			New Password
			<input name="new_password" type="password" placeholder="Use a Password Manager" />
		</label>

        <label>
			Confirm New Password
			<input name="confirm_password" type="password" placeholder="Confirmation" />
		</label>

        <div>
		    <button>Update</button>
        </div>
	</form>
</main>

<style lang="scss">
	:global(li) {
		padding: 5px 0;
	}

	:global(pre) {
		padding: 10px;
		line-height: 1.75em;
		word-wrap: normal;
		white-space: pre-wrap;
	}

	:global(code) {
		display: inline;
		font-size: 14px;
		padding: 3px;
		border-radius: 4px;
		background: #f5f5f5;
	}

	:global(a),
	:global(a:visited) {
		color: black;
	}

	:global(a:hover) {
		color: red;
		transition-duration: 0.5s;
	}

	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: top;
		height: 100vh;

		form {
			display: flex;
			flex-direction: column;
			max-width: 300px;
            text-align: center;

            h3 {
                font-family: "Open Sans";
                font-size: 20px;
                font-weight: 600;
                padding: 10px 0;
                margin: 10px 0;
                border-bottom: 1px solid #ddd;
            }

			label {
				width: 100%;
				padding: 5px 0;
				font-family: 'Open Sans';
				font-size: 14px;
                text-align: left;

				input {
					width: 100%;
					padding: 10px;
					margin: 5px 0;
					border-radius: 7px;
					border: 0;
					outline: 1px solid #999;
				}

				input:hover,
				input:focus {
					outline: 1px solid darkred;
					transition-duration: 0.5s;
				}
			}

            div {
                display: inline-block;
                width: 100%;
                border-top: 1px solid #ddd;
                margin-top: 10px;
            
                button {
                    border-radius: 7px;
                    background: darkred;
                    color: whitesmoke;
                    transition-duration: 1s;
                    border: 0;
                    font-family: 'Open Sans';
                    font-size: 18px;
                    font-weight: 600;
                    padding: 5px 15px;
                    margin: 15px 0;
                }

                button:hover {
                    color: darkred;
                    background: whitesmoke;
                    transition-duration: 1s;
                    cursor: pointer;
                }
            }
		}
	}
</style>
