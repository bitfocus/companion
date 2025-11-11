import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import legacyPlugin from '@vitejs/plugin-legacy'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import fs from 'fs'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

const upstreamUrl = process.env.UPSTREAM_URL || '127.0.0.1:8000'

const buildFile = fs
	.readFileSync(path.join(import.meta.dirname, '../BUILD'))
	.toString()
	.trim()

/**
 * Parse --base argument from command line
 * This is a horrible hack, but Vite does not provide a way to access the base path directly from the config.
 */
function getBaseFromArgs(): string {
	// Handle --base=value format
	const baseEqualArg = process.argv.find((arg) => arg.startsWith('--base='))
	if (baseEqualArg) {
		return baseEqualArg.split('=')[1]
	}

	// Handle --base value format
	const baseIndex = process.argv.findIndex((arg) => arg === '--base')
	if (baseIndex !== -1 && baseIndex + 1 < process.argv.length) {
		return process.argv[baseIndex + 1]
	}

	return '/'
}

// Get the base path from Vite's --base argument
const basePath = getBaseFromArgs()
let normalizedBase = basePath
if (!normalizedBase.startsWith('/')) normalizedBase = `/${normalizedBase}`
normalizedBase = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase

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
		allowedHosts: ['bs-local.com'],
		proxy: {
			[`${normalizedBase}/instance`]: {
				target: `http://${upstreamUrl}`,
				rewrite: (path) => path.slice(normalizedBase.length),
			},
			[`${normalizedBase}/connections/instance`]: {
				target: `http://${upstreamUrl}`,
				rewrite: (path) => path.slice(normalizedBase.length),
			},
			[`${normalizedBase}/int`]: {
				target: `http://${upstreamUrl}`,
				rewrite: (path) => path.slice(normalizedBase.length),
			},
			[`${normalizedBase}/user-guide`]: {
				target: `http://${upstreamUrl}`,
				rewrite: (path) => path.slice(normalizedBase.length),
			},
			[`${normalizedBase}/trpc`]: {
				target: `ws://${upstreamUrl}`,
				ws: true,
				rewrite: (path) => path.slice(normalizedBase.length),
			},
		},
	},
	plugins: [
		tsconfigPaths(),
		tanstackRouter({
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
