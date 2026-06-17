import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		projects: [
			'webui/vitest.config.ts',

			{
				test: {
					name: 'shared-lib',
					root: 'shared-lib',
					exclude: [
						'**/module-local-dev/**',
						'**/bundled-modules/**',
						'**/node_modules/**',
						'**/dist/**',
						'**/build/**',
						'**/coverage/**',
						'**/webui/**',
					],
				},
			},

			{
				test: {
					name: 'companion',
					root: 'companion',
					setupFiles: ['./test/setup.ts'],
					exclude: [
						'**/module-local-dev/**',
						'**/bundled-modules/**',
						'**/node_modules/**',
						'**/dist/**',
						'**/build/**',
						'**/coverage/**',
						'**/webui/**',
					],
				},
			},

			{
				test: {
					name: 'config-tool',
					root: 'config-tool',
					exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
				},
			},
		],
		// reporters: ['default', 'html'],
		// coverage: {
		// 	reporter: ['text', 'json', 'html'],
		// 	include: ['companion/**', 'shared-lib/**'],
		// 	exclude: [
		// 		'**/module-local-dev/**',
		// 		'**/bundled-modules/**',
		// 		'**/node_modules/**',
		// 		'**/dist/**',
		// 		'**/build/**',
		// 		'**/coverage/**',
		// 		'**/webui/**',
		// 	],
		// },
	},
})
