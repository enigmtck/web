<script lang="ts">
	export let links: Metadata[];

	type Metadata = {
		twitterTitle?: string | null;
		description?: string | null;
		ogDescription?: string | null;
		ogTitle?: string | null;
		ogImage?: string | null;
		ogSiteName?: string | null;
		twitterImage?: string | null;
		ogUrl?: string | null;
		twitterDescription?: string | null;
		published?: string | null;
		twitterSite?: string | null;
		ogType?: string | null;
	};

	let selectedIndex: number = 0;
</script>

{#if links[selectedIndex].ogUrl && links[selectedIndex].ogTitle}
	<a href={links[selectedIndex].ogUrl} target="_blank" rel="noreferrer">
		<div>
			{#if links[selectedIndex].ogImage?.length}
				<div class="image">
					<img src={links[selectedIndex].ogImage} alt="Link Preview" />
				</div>
			{/if}
			<div>
				<span>{links[selectedIndex].ogTitle}</span>

				{#if links[selectedIndex].ogDescription}
					<span>{links[selectedIndex].ogDescription}</span>
				{/if}
			</div>
		</div>
	</a>
{/if}

<style lang="scss">
	a {
		width: 100%;
		display: block;

		div {
			width: calc(100% - 20px);
			display: flex;
			flex-direction: row;
			margin: 10px;
			border: 1px solid #eee;
			background: #fafafa;

			div {
				border: 0;
				padding: 5px;
				display: flex;
				flex-direction: column;

				span {
					font-size: 13px;
					padding-bottom: 5px;
					color: black;
				}
				span:first-child {
					font-weight: 600;
					font-size: 16px;
				}
			}

			.image {
				max-width: 150px;
				padding: 5px 0 5px 5px;
				margin: 10px 0 10px 10px;

				img {
					width: unset;
					height: unset;
					clip-path: unset;
					width: 100%;
					border: 1px solid #777;
				}
			}
		}
	}

	:global(body.dark) {
		a {
			div {
				background: #151515;
				border: 1px solid #222;

				div {
					border: 0;

					span {
						color: white;
					}
					span:first-child {
						color: #aaa;
					}
				}
			}
		}
	}
</style>
