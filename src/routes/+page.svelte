<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
</script>

<main>
	<div>
		<h1>ENIGMATICK</h1>

		<ul>
			<li><a href="/login">Login</a></li>
			<li><a href="/signup">Sign Up</a></li>
		</ul>
	</div>
</main>

<style lang="scss">
	main {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100vw;
		height: 100vh;
	}

	h1 {
		font-family: 'Open Sans';
		font-size: 12vw;
		text-align: center;
		font-weight: 300;
		color: darkred;
		margin: 0;
	}

	ul {
		display: block;
		width: 300px;
		list-style: none;
		padding: 0;
		margin: 0 auto;
		text-align: center;

		li {
			float: left;
			width: 50%;
			text-align: center;
			border-right: 1px solid #222;

			a {
				color: #222;
				text-decoration: none;
				font-family: 'Open Sans';
				font-size: 24px;
			}

			a:hover {
				color: red;
				transition-duration: 0.5s;
			}
		}

		li:last-child {
			border-right: 0;
		}
	}

	:global(body.dark) {
		h1 {
			color: #444;
		}

		ul {
			li {
				border-right: 1px solid #fff;

				a {
					color: #ddd;
				}

				a:hover {
					color: red;
				}
			}

			li:last-child {
				border-right: 0;
			}
		}
	}
</style>
