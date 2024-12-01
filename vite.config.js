import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';

export default defineConfig({
	plugins: [sveltekit(), wasmPack('wasm/enigmatick_wasm')],
	build: {
		assetsDir: 'assets'
	},
	server: {
		hmr: {
			host: '127.0.0.1',
			port: 5174,
			protocol: 'ws'
		},
		cors: false,
		host: true,
		port: 5273,
		proxy: {
			'/events': {
				target: 'http://10.42.113.8/',
				changeOrigin: true,
				secure: false,
				ws: false
			},
			'/api': {
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/user': {
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/conversation': {
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/inbox': {
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/.well-known': {
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/media': {
				target: 'https://enigmatick.social/',
				changeOrigin: false,
				secure: false,
				ws: false
			}
		}
	}
});
