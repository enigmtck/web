<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { wasmState, appData } from '../../stores';
	import init_wasm, {
		OtkUpdateParams,
		add_one_time_keys,
		get_hash,
		authenticate,
		SendParams,
		send_note,
		send_encrypted_note,
		get_inbox,
		get_processing_queue,
		upload_avatar,
		load_instance_information,
		get_state,
		import_state as import_wasm_state,
		create_olm_message,
		decrypt_olm_message,
		get_one_time_keys
	} from 'enigmatick_wasm';

	function load_enigmatick() {
		init_wasm().then(() => {
			load_instance_information().then((instance) => {
				console.log(instance?.domain);
				console.log(instance?.url);

				if (get(wasmState)) {
					import_wasm_state(get(wasmState));
					console.log('loaded state from store');
				}
				console.log('init WASM');
			});
		});
	}

	let username = get(appData).username;

	onMount(() => {
		load_enigmatick();

		/* if (username) {
			const sse = new EventSource('/api/user/' + username + '/events');
			sse.onmessage = (event) => {
				console.log('event: ' + event.data);
			};
			return () => {
				if (sse.readyState === 1) {
					sse.close();
				}
			};
		} */
	});

	function handleLogin(event: any) {
		let data = new FormData(event.target);

		authenticate(String(data.get('username')), String(data.get('password'))).then((profile) => {
			let actor = appData.set({
				username: String(profile?.username),
				display_name: String(profile?.display_name),
				avatar: String(profile?.avatar_filename),
				domain: null,
				url: null
			});
			username = get(appData).username;
			let x = get_state();
			console.log(x);
			wasmState.set(x.export());
			let data = JSON.stringify({
				pickled_account: x.get_olm_pickled_account(),
				olm_sessions: JSON.parse(x.get_olm_sessions())
			});
			console.log(get(wasmState));

			if (username) {
				const sse = new EventSource('/api/user/' + username + '/events');
				sse.onmessage = (event) => {
					console.log('event: ' + event.data);
				};
			}
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

	async function handleQueue(event: any) {
		console.log(event);
		get_processing_queue().then(async (x) => {
			console.log(x);
			let ap_object = JSON.parse(String(x));

			console.log(ap_object);

			ap_object.items.forEach(
				async (item: {
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
							let a = get_state().get_olm_pickled_account;
							//let key = get_external_identity_key(item.attributedTo);
							/* 							plaintext = String(
								decrypt_olm_message(item.attributedTo, item.content, String(a), String(key))
							);
							console.log(plaintext);
 */
							// this updates the keystore in wasm, but doesn't push it to the server; that action
							// below is handled by send_encrypted_note
							//update_keystore_olm_sessions(get_olm_state().get_olm_sessions());
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

	async function handleSend(
		event: any,
		recipient: string,
		identity_key?: string,
		session_key?: string
	) {
		let data = new FormData(event.target);

		console.log(event);
		console.log(recipient);
		console.log(identity_key);
		console.log(session_key);
		console.log(data.get('content'));

		let encrypted_message = '';

		let a = get_state().get_olm_pickled_account;

		if (identity_key && session_key) {
			encrypted_message = String(
				create_olm_message(
					recipient,
					String(data.get('content')),
					String(a),
					identity_key,
					session_key
				)
			);
		} else {
			encrypted_message = String(
				create_olm_message(recipient, String(data.get('content')), String(a))
			);
		}

		let note = await SendParams.new();
		note = await note.add_recipient_id(recipient, false);
		note = note.set_content(String(encrypted_message));
		note = note.set_encrypted();

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

					upload_avatar(b, (avatar as ArrayBuffer).byteLength, '');
					/* fetch('/api/user/avatar', {
						method: 'POST',
						body: avatar
					}).then((x) => console.log("maybe this time? " + x)) */
				}
			};
		}
	};

	async function handleGetOneTimeKeys(event: any) {
		const a = get_state().get_olm_pickled_account();
		console.info('PRE-MUTATION');
		console.log(a);

		let hash = get_hash(new TextEncoder().encode(String(a)));
		console.info('HASH');
		console.log(hash);

		let otk = get_one_time_keys(String(a));
		console.info('KEYS');
		console.log(otk.one_time_keys);
		console.info('PICKLED ACCOUNT');
		console.log(otk.pickled_account);

		console.info('POST-MUTATION');
		console.log(get_hash(new TextEncoder().encode(otk.pickled_account)));

		let params = OtkUpdateParams.new()
			.set_account(otk.pickled_account)
			.set_account_hash(String(get_hash(new TextEncoder().encode(otk.pickled_account))))
			.set_mutation(String(hash))
			.set_keys(otk.one_time_keys);

		add_one_time_keys(params);
	}
</script>

<main>
	{#if username}
		<button on:click={handleGetOneTimeKeys}>OTK</button>
		<div>Logged in as: <a href="/@{username}">{username}</a></div>

		<div>
			<!-- {#if avatar}
        <img class="avatar" src="{avatar}" alt="d" />
    {/if} -->
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<img
				class="upload"
				src="https://static.thenounproject.com/png/625182-200.png"
				alt=""
				on:click={() => {
					fileinput.click();
				}}
			/>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
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
</main>
