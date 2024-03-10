import dotenv from 'dotenv';
dotenv.config();

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';


/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		//adapter: adapter()
		adapter: process.env.ADAPTER === 'static'
		? adapterStatic({ fallback: '200.html' })
		: adapterNode()
	},
};

export default config;
