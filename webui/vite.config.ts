import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, loadEnv } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import legacyPlugin from '@vitejs/plugin-legacy'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import fs from 'fs'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { normalizeBasePath } from '../tools/webui-dev-utils'

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

const normalizedBase = normalizeBasePath(getBaseFromArgs())

export default defineConfig(({ mode }) => {
	// Load all vars (no prefix filter) from the workspace root .env files
	const env = loadEnv(mode, path.join(import.meta.dirname, '..'), '')

	// UPSTREAM_URL takes precedence; fall back to COMPANION_APP_PORT, then the default
	const upstreamUrl =
		env.UPSTREAM_URL ?? (env.COMPANION_APP_PORT ? `localhost:${env.COMPANION_APP_PORT}` : 'localhost:8000')

	return {
		publicDir: 'public',
		// This changes the out put dir from dist to build
		// comment this out if that isn't relevant for your project
		build: {
			outDir: 'build',
			chunkSizeWarningLimit: 1 * 1000 * 1000, // Disable warning about large chunks
			sourcemap: true,
		},
		server: {
			port: parseInt(env.COMPANION_UI_PORT || '', 10) || undefined,
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
					// forward to Docusaurus (note: if changing hostname, change it in tools/webui-dev-docs.mts too)
					target: `http://localhost:4000`,
					changeOrigin: true, // not strictly necessary, but probably good practice for "external" servers
					// rewrite: don't rewrite for docusaurus - it testing a base_url use 'yarn dev:docs --base' or manually set env BASE_URL for docusaurus to use
					configure: (proxy) => {
						// Handle ECONNREFUSED errors, by showing the placeholder page (instead of a generic error page)
						const placeholderHtml = fs.readFileSync(path.join(import.meta.dirname, '../docs/placeholder/index.html'))
						proxy.on('error', (err, _req, res) => {
							if ((err as NodeJS.ErrnoException).code !== 'ECONNREFUSED') return
							if ('writeHead' in res) {
								res.writeHead(502, { 'Content-Type': 'text/html' })
								res.end(placeholderHtml)
							}
						})
					},
				},
				[`${normalizedBase}/trpc`]: {
					target: `ws://${upstreamUrl}`,
					ws: true,
					rewrite: (path) => path.slice(normalizedBase.length),
				},
				[`${normalizedBase}/_deps`]: {
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
			env.VITE_SENTRY_DSN
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
	}
})
