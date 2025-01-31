import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		exclude: [
			'**/module-local-dev/**',
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/coverage/**',
			'**/webui/**',
		],
	},
})
