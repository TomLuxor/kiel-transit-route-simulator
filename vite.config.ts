import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
	// Relative asset paths: the build runs both at the root (vite preview) and in the subfolder of GitHub Pages
	// (/kiel-transit-route-simulator/). The app has a single page and no router, so nothing else depends on the path.
	base: './',
	plugins: [
		vue(),
		vueDevTools(),
	],
	resolve: {
		alias: [
			{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
		],
	},
})
