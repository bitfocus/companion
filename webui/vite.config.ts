import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, type Plugin } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import legacyPlugin from '@vitejs/plugin-legacy'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

// note: in order to correctly work with Docusaurus we need to use localhost rather than 127.0.0.1
//  presumably to avoid IPv4/IPv6 mismatches.
const upstreamUrl = process.env.UPSTREAM_URL || 'localhost:8000'
const upstreamHost = upstreamUrl.split(':')[0]

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

// plugin to start docusaurus server: default expecting the server started independently
// noDocs=1 was the previous behavior
const noDocServer = !!process.env.WEBUI_NO_DOCS // if set we don't proxy docusaurus
const withDocs = !!process.env.WEBUI_DOCS && !noDocServer // if set, we start docusaurus here
function docusaurusPlugin(): Plugin {
	let proc: ReturnType<typeof spawn> | null = null

	return {
		name: 'docusaurus',
		configureServer(server) {
			const env = { ...process.env, BASE_URL: normalizedBase }
			proc = spawn('yarn', ['start', '--no-open'], {
				cwd: path.join(import.meta.dirname, '../docs'),
				env,
				stdio: ['pipe', 'inherit', 'inherit'], // stdin  piped (to answer prompts), stdout+stderr visible,
				shell: true,
				detached: process.platform !== 'win32', // needed for process.kill(-pid) on Unix
			})
			// answer "n" to any port-in-use prompt so it exits cleanly, just to be safe (the particular underlying problem appears to have been solved for now)
			proc.stdin?.write('n\n')
			proc.stdin?.end()
			proc.on('error', (err) => console.error('Failed to start Docusaurus:', err))

			// kill when Vite shuts down
			const cleanup = () => {
				if (proc?.pid) {
					console.log('Shutting down Docusaurus, pid:', proc.pid)
					// note: we could replace this with tree-kill (package) but then it needs an "Atomics.wait" hack to make sure it completes before Vite exits
					// (otherwise stopping Vite with 'q' won't stop Docusaurus).
					if (process.platform === 'win32') {
						spawnSync('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { shell: true })
					} else {
						process.kill(-proc.pid)
					}
					proc = null
				}
			}
			server.httpServer?.on('close', cleanup)
			process.on('beforeExit', cleanup) // catches ending Vite by typing "q"
			process.on('exit', cleanup) // final safety net
		},
	}
}

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
			[`${normalizedBase}/user-guide`]: noDocServer
				? {
						// forward to Express, which may show an error screen
						target: `http://${upstreamUrl}`,
						rewrite: (path) => path.slice(normalizedBase.length),
					}
				: {
						// forward to Docusaurus
						target: `http://${upstreamHost}:4000`,
						changeOrigin: true, // not strictly necessary, but probably good practice for "external" servers
						// don't rewrite for docusaurus if starting it here (BASE_URL is passed to docusaurus)
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
		withDocs ? docusaurusPlugin() : undefined,
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
