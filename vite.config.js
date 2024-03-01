import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';
import inject from '@rollup/plugin-inject';

export default defineConfig({
	plugins: [wasmPack('wasm/enigmatick_wasm'), sveltekit()],
	resolve: {
		alias: {
			path: 'path-browserify'
		}
	},
	build: {
		rollupOptions: {
			plugins: [inject({ Buffer: ['buffer', 'Buffer'] })]
		}
	},
	server: {
		hmr: {
			host: '127.0.0.1',
			port: 5174,
			protocol: 'ws'
		},
		cors: false,
		host: true,
		proxy: {
			'/events': {
				target: 'http://127.0.0.1:8010/',
				changeOrigin: true,
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
			'/conversation': {
				target: 'http://127.0.0.1:8010/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/inbox': {
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
	}
});
