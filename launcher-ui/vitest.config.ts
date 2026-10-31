import { defaultClientConditions } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
		// Resolve @companion-app/shared to its raw TypeScript sources (no separate `tsc` emit).
		// Setting conditions replaces the defaults, so re-add them.
		conditions: ['companion:source', ...defaultClientConditions],
	},
	test: {
		name: 'launcher-ui',
		exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
		environment: 'jsdom',
	},
})
