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

<a href={links[selectedIndex].ogUrl} target="_blank" rel="noreferrer">
	<div>
		<div class="image">
			<img src={links[selectedIndex].ogImage} alt="Link Preview" />
		</div>
		<div>
			<span>{links[selectedIndex].ogTitle}</span>
			<span>{links[selectedIndex].ogDescription}</span>
		</div>
	</div>
</a>

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
				padding: 5px;

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
</style>
