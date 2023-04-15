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
				min-width: 60%;
				border: 0;
				padding: 5px;
				display: flex;
				flex-direction: column;
				mask: linear-gradient(
							to bottom,
							rgba(0, 0, 0, 1) 0,
							rgba(0, 0, 0, 1) 50%,
							rgba(0, 0, 0, 0) 83%,
							rgba(0, 0, 0, 0) 0
						)
						100% 50% / 100% 100% repeat-x;

				span {
					display: block;
					font-size: 13px;
					padding-bottom: 5px;
					color: black;
					max-height: 100px;
					overflow: hidden;
					text-overflow: ellipsis;
					
				}
				span:first-child {
					white-space: nowrap;
					max-height: 22px;
					font-weight: 600;
					font-size: 16px;
					mask: unset;
				}
			}

			.image {
				min-width: unset;
				max-width: 25%;
				padding: 5px 0 5px 5px;
				margin: 10px 0 10px 10px;
				display: flex;
				align-items: center;
				justify-content: center;
				mask: unset;

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
