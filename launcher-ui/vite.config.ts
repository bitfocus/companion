import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import reactPlugin from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { recordLicenseInputs } from '../tools/licenses/vite-plugin.mts'

export default defineConfig(({ mode }) => {
	// Load all vars (no prefix filter) from the workspace root .env files
	const env = loadEnv(mode, path.join(import.meta.dirname, '..'), '')

	return {
		publicDir: 'public',
		base: './',
		build: {
			outDir: 'build',
			chunkSizeWarningLimit: 1 * 1000 * 1000, // Disable warning about large chunks
			sourcemap: true,
		},
		plugins: [
			reactPlugin(),
			tailwindcss(),
			// Rollup has no metafile, so record what this bundle shipped for the license inventory to attribute.
			// vite and rolldown are named because they copy their own runtime code into the shipped chunks.
			recordLicenseInputs({ name: 'launcher-ui', bundlerRuntimePackages: ['vite', 'rolldown'] }),
			// process.env.VITE_SENTRY_DSN
			// 	? sentryVitePlugin({
			// 			org: 'bitfocus',
			// 			project: 'companion-ui',
			// 			url: 'https://sentry2.bitfocus.io/',
			// 			release: { name: buildFile },
			// 		})
			// 	: undefined,
		],
		server: {
			host: env.COMPANION_UI_HOST || undefined,
		},
		resolve: {
			tsconfigPaths: true,
			alias: {
				'~': path.resolve(import.meta.dirname, './src'),
			},
		},
	}
})
