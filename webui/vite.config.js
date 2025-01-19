import { defineConfig } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import * as envCompatible from 'vite-plugin-env-compatible'
import legacyPlugin from '@vitejs/plugin-legacy'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

const upstreamUrl = process.env.UPSTREAM_URL || '127.0.0.1:8000'

// https://vitejs.dev/config/
export default defineConfig({
	publicDir: 'public',
	// This changes the out put dir from dist to build
	// comment this out if that isn't relevant for your project
	build: {
		outDir: 'build',
		chunkSizeWarningLimit: 1 * 1000 * 1000, // Disable warning about large chunks
	},
	server: {
		proxy: {
			'/int': `http://${upstreamUrl}`,
			'/docs': `http://${upstreamUrl}`,
			'/socket.io': {
				target: `ws://${upstreamUrl}`,
				ws: true,
			},
		},
	},
	plugins: [
		TanStackRouterVite({
			virtualRouteConfig: './src/routes/-routes.ts',
			addExtensions: true,
		}),
		reactPlugin(),
		envCompatible.default({
			prefix: 'DEV',
		}),
		legacyPlugin({
			targets: ['defaults', 'not IE 11', 'safari >= 12.1'],
		}),
	],
	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler',
				quietDeps: true,
			},
		},
	},

	resolve: {
		alias: {
			'react-windowed-select': 'react-windowed-select/dist/main.js',
		},
	},
})
