import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';

// /** @type {import('vite').UserConfig} */
// const config = {
// 	plugins: [sveltekit()]
// };

export default defineConfig({
	plugins: [sveltekit(), wasmPack('../enigmatick_wasm'), wasmPack('../enigmatick_olm')],
	server: {
		hmr: {
			host: "127.0.0.1",
			port: 5174,
			protocol: "ws"
		},
		cors: false,
		host: true,
		proxy: {
			'/events': {
				target: 'http://127.0.0.1:8010/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/api': {
				target: 'http://127.0.0.1:8010/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/user': {
				target: 'http://127.0.0.1:8010/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/.well-known': {
				target: 'http://127.0.0.1:8010/',
				changeOrigin: false,
				secure: false,
				ws: false
			}
		}
	},
});
