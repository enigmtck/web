<script lang="ts">
	import { page } from '$app/stores';
	import Reply from '../timeline/components/Reply.svelte';
	import Article from '../timeline/components/Article.svelte';
	import { onMount, setContext } from 'svelte';

	import { enigmatickWasm } from '../../stores';
	import type { UserProfile, Note } from '../../common';
	import { compare, DisplayNote, extractUuid } from '../../common';

	$: wasm = $enigmatickWasm;

	async function loadObject() {
		if (wasm) {
			console.log('LOADING PROFILE');
			let x = await fetch('/objects/' + $page.url.searchParams.get('uuid'), {
				headers: {
					Accept: 'application/activity+json'
				}
			});

			let y = await x.json();

			let actorStr = await wasm.get_actor(y.attributedTo);

			if (actorStr) {
				const actor: UserProfile = JSON.parse(actorStr);
				note = new DisplayNote(actor, y);
				console.log(note);

				if (y.conversation) {
					const uuid = extractUuid(y.conversation);

					if (uuid) {
						let conversationStr = await wasm.get_local_conversation(uuid);
						if (conversationStr) {
							const conversation_notes: Note[] = JSON.parse(conversationStr);
							let replies = new Map<string, DisplayNote>();

							for (const conversation_note of conversation_notes) {
								if (conversation_note.id && conversation_note.id != y.id) {
									let actorStr = await wasm.get_actor(conversation_note.attributedTo);
									if (actorStr) {
										const reply_actor: UserProfile = JSON.parse(actorStr);
										replies.set(
											String(conversation_note.id),
											new DisplayNote(reply_actor, conversation_note)
										);
										note = new DisplayNote(actor, y, undefined, replies);
									}
								}
							}

							console.info(replies);
						}
					}
				}
			}
		}
	}

	function refresh() {
		console.debug('REFRESH');
	}

	function remove() {
		console.debug('REMOVE');
	}

	let note: DisplayNote | null = null;

	function renderAction(note: any) {}

	let apCache = new Map<string, string | undefined>();
	async function cachedNote(id: string): Promise<string | undefined> {
		if (wasm && !apCache.has(id)) {
			apCache.set(id, await wasm.get_note(id));
		}

		return apCache.get(id);
	}

	$: if (wasm && $page.url.searchParams.get('uuid')) {
		(async () => {
			try {
				await loadObject();
				console.log('loadObject');
			} catch (error) {
				console.error('Error loading object:', error);
			}
		})();
	}
</script>

<main>
	{#if wasm && note}
		<Article {remove} {refresh} {note} username={null} {renderAction} {cachedNote} />
		{#if note.replies?.size}
			<div class="replies">
				{#each Array.from(note.replies.values()).sort(compare) as reply}
					<Reply note={reply} username={null} />
				{/each}
			</div>
		{/if}
	{/if}
</main>

<style lang="scss">
	main {
		grid-area: content;
		max-width: 700px;
		width: 100%;
		height: calc(100% - 41px);
		margin: 0 auto;
		font-family: 'Open Sans';
		overflow-y: auto;

		.replies {
			padding-bottom: 60px;
			display: flex;
			flex-direction: column;
			align-items: center;
		}
	}
</style>
