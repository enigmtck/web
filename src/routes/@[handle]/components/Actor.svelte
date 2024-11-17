<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { appData, enigmatickWasm } from '../../../stores';
	import type {
		UserProfile,
		Note,
		Announce,
		AnnounceParams,
		Attachment,
		Activity,
		UserProfileTerse,
		Collection
	} from '../../../common';
	import {
		insertEmojis,
		compare,
		sleep,
		DisplayNote,
		extractMaxMin,
		convertMastodonUrlToWebfinger,
		cachedContent,
		formatProfileTags,

		getFirst

	} from '../../../common';

	export let profile: UserProfileTerse | UserProfile;

	$: wasm = $enigmatickWasm;
</script>

<div>
	<a href={getFirst(profile.url)} title={convertMastodonUrlToWebfinger(getFirst(profile.url) || '')}>
		<div class="image">
			{#if profile.icon}
				<img src={cachedContent(wasm, profile.icon.url)} alt="Avatar" />
			{/if}
		</div>
		<div class="text">
			{#if profile && profile.name}
				<span>{@html insertEmojis(wasm, profile.name, profile)}</span>
			{:else}
				<span>{profile.name}</span>
			{/if}
			<span class="handle">{convertMastodonUrlToWebfinger(getFirst(profile.url) || '', true) || getFirst(profile.url)}</span>
		</div>
	</a>
</div>

<style lang="scss">
	div {
		a {
			display: inline-block;
			display: grid;
			grid-template-columns: 50px 120px;
			grid-template-rows: auto;
			grid-template-areas: 'image text';
			color: #222;
			background: #fafafa;
			margin: 5px;
			border-radius: 5px;
			border: 1px solid #dadada;

			.image {
				grid-area: image;
				width: 100%;
				height: 50px;

				img {
					width: 50px;
					height: 100%;
					object-fit: cover;
					clip-path: inset(0 0 0 0 round 5px 0 0 5px);
					display: flex;
					justify-content: space-evenly;
					align-items: center;
				}
			}

			.text {
				grid-area: text;
				width: 100%;
				height: 50px;
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
				font-size: 14px;
				padding: 5px;
				display: flex;
				flex-direction: column;
				justify-content: center;

				span {
					display: inline-block;
					width: 100%;
					overflow: hidden;
					white-space: nowrap;
					text-overflow: ellipsis;
				}

				span.handle {
					color: #999;
					font-size: 12px;
				}
			}
		}
	}

	:global(body.dark) {
		div {
			a{
				border: 1px solid #222;
				background: #151515;
				color: white;
			}
		}
	}
</style>
