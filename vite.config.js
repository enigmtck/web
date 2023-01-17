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
		cors: false,
		proxy: {
			'/events': {
				target: 'http://172.16.227.130:8010/',
				changeOrigin: true,
				secure: false,
				ws: false
			},
			'/api': {
				target: 'http://172.16.227.130:8010/',
				changeOrigin: true,
				secure: false,
				ws: false
			},
			'/user': {
				target: 'http://172.16.227.130:8010/',
				changeOrigin: true,
				secure: false,
				ws: false
			}
		}
	},
});
