import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		name: 'webui',
		exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
		environment: 'jsdom',
		css: true,
		setupFiles: ['./src/test-setup.ts'],
	},
})
