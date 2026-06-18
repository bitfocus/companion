import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [],
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		name: 'webui',
		exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
		environment: 'jsdom',
		css: true,
		setupFiles: ['./src/test-setup.ts'],
	},
})
