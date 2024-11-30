import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';
import inject from '@rollup/plugin-inject';
//import wasm from "vite-plugin-wasm";
//import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
	plugins: [wasmPack('wasm/enigmatick_wasm'), sveltekit()],
	//plugins: [sveltekit()],
	//plugins: [wasm(), topLevelAwait(), sveltekit()],
	// resolve: {
	// 	alias: {
	// 		path: 'path-browserify'
	// 	}
	// },
	// build: {
	// 	rollupOptions: {
	// 		plugins: []
	// 	}
	// },
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
				//target: 'http://127.0.0.1:8010/',
				target: 'http://10.42.113.8/',
				changeOrigin: true,
				secure: false,
				ws: false
			},
			'/api': {
				//target: 'http://127.0.0.1:8010/',
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/user': {
				//target: 'http://127.0.0.1:8010/',
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/conversation': {
				//target: 'http://127.0.0.1:8010/',
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/inbox': {
				//target: 'http://127.0.0.1:8010/',
				target: 'http://10.42.113.8/',
				changeOrigin: false,
				secure: false,
				ws: false
			},
			'/.well-known': {
				//target: 'http://127.0.0.1:8010/',
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
