import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		name: 'webui',
		exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
		environment: 'jsdom',
	},
})
