import { defaultClientConditions, defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	// Resolve @companion-app/shared to its raw TypeScript sources (no separate `tsc` emit).
	// The node-environment projects (shared-lib, companion, config-tool) resolve via SSR, so the
	// condition must be set for both. Setting conditions replaces the defaults, so re-add them.
	resolve: {
		conditions: ['companion:source', ...defaultClientConditions],
	},
	ssr: {
		resolve: {
			conditions: ['companion:source', ...defaultServerConditions],
		},
	},
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
