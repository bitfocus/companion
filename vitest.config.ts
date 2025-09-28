import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		projects: [
			'webui/vitest.config.ts',

			{
				test: {
					name: 'companion',
					root: '.',
					exclude: [
						'**/module-local-dev/**',
						'**/bundled-modules/**',
						'**/node_modules/**',
						'**/dist/**',
						'**/build/**',
						'**/coverage/**',
						'**/webui/**',
						'**/playwright/**',
					],
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
