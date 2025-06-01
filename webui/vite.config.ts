import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import legacyPlugin from '@vitejs/plugin-legacy'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import fs from 'fs'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

const upstreamUrl = process.env.UPSTREAM_URL || '127.0.0.1:8000'

const buildFile = fs.readFileSync(path.join(__dirname, '../BUILD')).toString().trim()

// https://vitejs.dev/config/
export default defineConfig({
	publicDir: 'public',
	// This changes the out put dir from dist to build
	// comment this out if that isn't relevant for your project
	build: {
		outDir: 'build',
		chunkSizeWarningLimit: 1 * 1000 * 1000, // Disable warning about large chunks
		sourcemap: true,
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
		tsconfigPaths(),
		TanStackRouterVite({
			virtualRouteConfig: './src/routes/-routes.ts',
			addExtensions: true,
		}),
		reactPlugin(),
		legacyPlugin({
			targets: ['defaults', 'not IE 11', 'safari >= 12.1'],
		}),
		process.env.VITE_SENTRY_DSN
			? sentryVitePlugin({
					org: 'bitfocus',
					project: 'companion-ui',
					url: 'https://sentry2.bitfocus.io/',
					release: { name: buildFile },
				})
			: undefined,
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
