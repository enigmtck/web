<script lang="ts">
    import { enigmatickWasm } from '../../../stores';
    import { onDestroy, onMount, getContext } from 'svelte';

	let {
		object,
		owner,
		remove,
		reload
	}: {
		object: string;
		owner: boolean;
		remove: (note: string) => void;
		reload: () => void;
	} = $props();

    let wasm = $derived($enigmatickWasm);
    
    onMount(async () => {
        if (wasm) {
        }
    })

	function handleMenu(event: any) {
		console.log('HANDLE MENU ACTIVATED');

		if (dialog.open) {
			dialog.close();
		} else {
			dialog.show();
		}
	}

    function handleDelete(event: any) {
        console.log('HANDLE DELETE ACTIVATED');
        const id = event.target.dataset.object;

        wasm?.send_delete(id).then((x) => {
            if (x) {
                console.info('DELETE SENT');
				remove(id);
            }
        })
    }

	let dialog: HTMLDialogElement;
</script>


<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<i class="fa-solid fa-ellipsis" data-object={object} onclick={(e) => { e.preventDefault(); handleMenu(e); }}></i>

<dialog bind:this={dialog}>
	<ul>
        {#if owner}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <li data-object={object} onclick={(e) => { e.preventDefault(); handleDelete(e); }}>Delete</li>
            <li>Edit</li>
        {/if}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<li onclick={(e) => { e.preventDefault(); reload(); }}>Reload Replies</li>
        <li>Mute Author</li>
        <li>Block Author</li>
        <li>Block Instance</li>
	</ul>
</dialog>

<style lang="scss">
	i {
		text-align: center;
		width: calc(100% / 5);
	}

	i:hover {
		cursor: pointer;
		color: red;
	}

	dialog {
		margin: 0;
		padding: 10px;
		position: absolute;
		bottom: 30px;
		left: calc(100% - 160px);
		height: auto;
		width: 140px;
		background: white;
		border: 1px solid #aaa;
		cursor: pointer;
		transition-duration: 0.5s;

		ul {
			padding: 0;
			margin: 0;

			li {
				list-style: none;
				padding: 0 5px;
				margin: 2px 0;
				font-family: 'Open Sans';
				font-size: 13px;
                font-weight: 500;
			}

			li:hover {
				color: #222;
				background: #eee;
			}
		}
	}

	:global(body.dark) {
		dialog {
			background: #444;
            border: 1px solid #222;
            color: white;
		}
	}
</style>
