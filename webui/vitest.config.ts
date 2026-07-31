import { defaultClientConditions } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [],
	resolve: {
		tsconfigPaths: true,
		// Resolve @companion-app/shared to its raw TypeScript sources (no separate `tsc` emit).
		// Setting conditions replaces the defaults, so re-add them.
		conditions: ['companion:source', ...defaultClientConditions],
	},
	test: {
		name: 'webui',
		exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
		environment: 'jsdom',
		css: true,
		setupFiles: ['./src/test-setup.ts'],
	},
})
