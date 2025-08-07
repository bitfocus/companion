import { defineConfig } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	publicDir: 'public',
	base: './',
	build: {
		outDir: 'build',
		chunkSizeWarningLimit: 1 * 1000 * 1000, // Disable warning about large chunks
		sourcemap: true,
	},
	plugins: [
		tsconfigPaths(),
		reactPlugin(),
		// process.env.VITE_SENTRY_DSN
		// 	? sentryVitePlugin({
		// 			org: 'bitfocus',
		// 			project: 'companion-ui',
		// 			url: 'https://sentry2.bitfocus.io/',
		// 			release: { name: buildFile },
		// 		})
		// 	: undefined,
	],
	css: {
		preprocessorOptions: {
			scss: {
				quietDeps: true,
			},
		},
	},
})
