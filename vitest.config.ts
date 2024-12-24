import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		reporters: ['default', 'html'],
		exclude: [
			'**/module-local-dev/**',
			'**/bundled-modules/**',
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/coverage/**',
		],
		coverage: {
			reporter: ['text', 'json', 'html'],
			include: ['companion/**', 'shared-lib/**'],
			exclude: [
				'**/module-local-dev/**',
				'**/bundled-modules/**',
				'**/node_modules/**',
				'**/dist/**',
				'**/build/**',
				'**/coverage/**',
			],
		},
	},
})
