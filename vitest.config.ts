import { defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

// Resolve @companion-app/shared to its raw TypeScript sources (no separate `tsc` emit) via the
// `companion:source` export condition. The node-environment projects resolve dependencies through
// Vite's SSR resolver, and inline projects do NOT inherit the root config's `resolve`/`ssr`
// options, so this must be set on each project that imports the package.
//
// Setting conditions replaces the defaults, so we re-add `defaultServerConditions` — but drop
// `module`, which otherwise makes some externalised deps (e.g. @opentelemetry/api) resolve to a
// bundler-only ESM build with extensionless imports that Node cannot load.
const ssrSourceResolve = {
	resolve: {
		conditions: ['companion:source', ...defaultServerConditions.filter((c) => c !== 'module')],
	},
}

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
				ssr: ssrSourceResolve,
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
				ssr: ssrSourceResolve,
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
