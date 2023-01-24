<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, olmState, appData } from '../../stores';
	import init_wasm, {
		authenticate,
		SendParams,
		send_note,
		send_encrypted_note,
		get_inbox,
		get_processing_queue,
		get_external_identity_key,
		update_keystore_olm_sessions,
		upload_avatar,
		load_instance_information,
		get_state as get_wasm_state,
		import_state as import_wasm_state
	} from 'enigmatick_wasm';
	import init_olm, {
		import_state as import_olm_state,
		get_state as get_olm_state,
		create_olm_message,
		decrypt_olm_message
	} from 'enigmatick_olm';

	function load_enigmatick() {
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

			init_olm().then(() => {
				if (get(olmState)) {
					import_olm_state(get(olmState));
					console.log('loaded olm state from store');
				}
				console.log('init OLM');
			});
		});
	}

	let username = get(appData).username;

	onMount(() => {
		load_enigmatick();

		if (username) {
			const sse = new EventSource('/api/user/' + username + '/events');
			sse.onmessage = (event) => {
				console.log('event: ' + event.data);
			};
			return () => {
				if (sse.readyState === 1) {
					sse.close();
				}
			};
		}
	});

	function handleLogin(event: any) {
		let data = new FormData(event.target);

		authenticate(
			String(data.get('username')),
			String(data.get('password')),
			String(data.get('passphrase'))
		).then((profile) => {
			appData.set({
				username: String(profile?.username),
				display_name: String(profile?.display_name)
			});
			username = get(appData).username;
			get_wasm_state().then((x) => {
				console.log(x);
				wasmState.set(x.export());
				let data = JSON.stringify({
					pickled_account: x.get_olm_pickled_account(),
					olm_sessions: JSON.parse(x.get_olm_sessions())
				});
				import_olm_state(data);
				console.log(get(wasmState));

				olmState.set(get_olm_state().export());

				if (username) {
					const sse = new EventSource('/api/user/' + username + '/events');
					sse.onmessage = (event) => {
						console.log('event: ' + event.data);
					};
				}
			});
		});
	}

	type Instrument = {
		type: string;
		content: string;
	};

	type Message = {
		recipient: string;
		sender: string;
		type: string;
		reference?: string;
		session_key?: string;
		identity_key?: string;
		content?: string;
		plaintext?: string;
	};

	let messages: Message[] = [];

	function addMessage(message: Message) {
		messages.push(message);
		messages = messages;
	}

	function handleInbox(event: any) {}

	function handleQueue(event: any) {
		console.log(event);
		get_processing_queue().then((x) => {
			console.log(x);
			let ap_object = JSON.parse(String(x));

			console.log(ap_object);

			ap_object.items.forEach(
				(item: {
					to: string[] | string;
					attributedTo: any;
					type: any;
					reference?: any;
					instrument?: Instrument | Array<Instrument>;
					content?: string;
				}) => {
					let instruments: Instrument[] = [];

					let identity_key = null;
					let session_key = null;

					if (item.instrument instanceof Object) {
						if ((item.instrument as Instrument).type == 'IdentityKey') {
							identity_key = (item.instrument as Instrument).content;
						} else if ((item.instrument as Instrument).type == 'SessionKey') {
							session_key = (item.instrument as Instrument).content;
						}
					}

					if (item.instrument instanceof Array) {
						item.instrument.forEach((element) => {
							if ((element as Instrument).type == 'IdentityKey') {
								identity_key = (element as Instrument).content;
							} else if ((element as Instrument).type == 'SessionKey') {
								session_key = (element as Instrument).content;
							}
						});
					}

					let recipient: string = '';

					if (typeof item.to === 'object') {
						recipient = item.to[0];
					}

					if (typeof item.to === 'string') {
						recipient = item.to;
					}

					if (identity_key && session_key) {
						let message: Message = {
							recipient,
							sender: item.attributedTo,
							type: item.type,
							reference: item.reference,
							identity_key,
							session_key
						};
						addMessage(message);
					}

					if (item.content) {
						let plaintext = '';

						if (item.type === 'EncryptedNote') {
							let key = get_external_identity_key(item.attributedTo);
							plaintext = String(decrypt_olm_message(item.attributedTo, item.content, String(key)));
							console.log(plaintext);

							// this updates the keystore in wasm, but doesn't push it to the server; that action
							// below is handled by send_encrypted_note
							update_keystore_olm_sessions(get_olm_state().get_olm_sessions());
						}
						let message: Message = {
							recipient,
							sender: item.attributedTo,
							type: item.type,
							content: item.content,
							plaintext
						};
						addMessage(message);
					}
				}
			);
		});
	}

	function handleSend(event: any, recipient: string, identity_key?: string, session_key?: string) {
		let data = new FormData(event.target);

		console.log(event);
		console.log(recipient);
		console.log(identity_key);
		console.log(session_key);
		console.log(data.get('content'));

		let encrypted_message = '';

		if (identity_key && session_key) {
			encrypted_message = String(
				create_olm_message(recipient, String(data.get('content')), identity_key, session_key)
			);
		} else {
			encrypted_message = String(create_olm_message(recipient, String(data.get('content'))));
		}

		console.log('Olm State');
		console.log(get_olm_state().export());
		console.log(get_olm_state().get_olm_sessions());
		update_keystore_olm_sessions(get_olm_state().get_olm_sessions());

		let note = SendParams.new();
		note.add_recipient_id(recipient);
		note.set_content(String(encrypted_message));
		note.set_kind('EncryptedNote');

		send_encrypted_note(note).then(() => {
			console.log('note sent');
		});
	}

	let avatar: string | ArrayBuffer | null, fileinput: HTMLInputElement;

	const onFileSelected = (e: Event) => {
		console.log('type :' + e.type);
		let target = e.target as HTMLInputElement;
		if (target.files !== null) {
			let image = target.files[0];
			let reader = new FileReader();
			reader.readAsArrayBuffer(image);
			reader.onload = (e: ProgressEvent<FileReader>) => {
				if (e.target !== null) {
					avatar = e.target.result !== null ? e.target.result : null;
					console.log(avatar);
					let b = new Uint8Array(avatar as ArrayBuffer);

					console.log('ba: ' + b);

					upload_avatar(b, (avatar as ArrayBuffer).byteLength, "");
					/* fetch('/api/user/avatar', {
						method: 'POST',
						body: avatar
					}).then((x) => console.log("maybe this time? " + x)) */
				}
			};
		}
	};
</script>

{#if username}
	<div>Logged in as: <a href="/@{username}">{username}</a></div>

	<div>
		<!-- {#if avatar}
        <img class="avatar" src="{avatar}" alt="d" />
    {/if} -->
		<img
			class="upload"
			src="https://static.thenounproject.com/png/625182-200.png"
			alt=""
			on:click={() => {
				fileinput.click();
			}}
		/>
		<div
			class="chan"
			on:click={() => {
				fileinput.click();
			}}
		>
			Choose Image
		</div>
		<input
			style="display:none"
			type="file"
			accept=".jpg, .jpeg, .png"
			on:change={(e) => onFileSelected(e)}
			bind:this={fileinput}
		/>
	</div>
{/if}

<form id="login" method="POST" on:submit|preventDefault={handleLogin}>
	<label>
		Username
		<input name="username" type="text" />
	</label>

	<label>
		Password
		<input name="password" type="password" />
	</label>

	<label>
		Passphrase
		<input name="passphrase" type="password" />
	</label>

	<button>Authenticate</button>
</form>

<a href="/message">Message</a>
<a href="/profile">Profile</a>

<button on:click|preventDefault={handleInbox}>Inbox</button>

<button on:click|preventDefault={handleQueue}>Queue</button>

<br />

<ul>
	{#each messages as message}
		<li>
			<div>
				<span>Recipient: {message.recipient}</span>
				<br />
				<span>Sender: {message.sender}</span>
				<br />
				<span>Type: {message.type}</span>
				<br />
				<!-- {#if message.content}
			<span>Content: {message.content}</span>
			{/if}
			<br/> -->
				{#if message.plaintext}
					<span>Message: {message.plaintext}</span>
					<form
						id="respond"
						method="POST"
						on:submit|preventDefault={() => handleSend(window.event, String(message.sender))}
					>
						<textarea name="content" />
						<button>Send</button>
					</form>
				{/if}
				{#if message.session_key && message.identity_key}
					<form
						id="message"
						method="POST"
						on:submit|preventDefault={() =>
							handleSend(
								window.event,
								String(message.sender),
								String(message.identity_key),
								String(message.session_key)
							)}
					>
						<textarea name="content" />
						<button>Send</button>
					</form>
				{/if}
			</div>
		</li>
	{/each}
</ul>
