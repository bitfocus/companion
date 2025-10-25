// @ts-check

import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslint from '@eslint/js'
import neslint from 'eslint-plugin-n'
import tseslint from 'typescript-eslint'
import reacteslint from 'eslint-plugin-react'
import hookseslint from 'eslint-plugin-react-hooks'
import reactRefreshEslint from 'eslint-plugin-react-refresh'
import pluginQuery from '@tanstack/eslint-plugin-query'

export default [
	// setup the parser first
	{
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: true,
			},
		},
	},

	{
		...neslint.configs['flat/recommended-script'],
		ignores: [...(neslint.configs['flat/recommended-script'].ignores ?? []), 'webui/**/*', 'launcher-ui/**/*'],
	},
	{
		// extends: commonExtends,
		plugins: {
			'@typescript-eslint': tseslint.plugin,
		},
		rules: {
			// Default rules to be applied everywhere
			'prettier/prettier': 'error',

			...eslint.configs.recommended.rules,

			'no-console': 'off',

			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_(.+)' },
			],
			'no-extra-semi': 'off',
			// 'n/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
			'no-use-before-define': 'off',
			'no-warning-comments': ['error', { terms: ['nocommit', '@nocommit', '@no-commit'] }],
			// 'jest/no-mocks-import': 'off',
		},
		files: ['**/*.ts', '**/*.cts', '**/*.mts', '**/*.tsx'],
	},
	...tseslint.configs.recommendedTypeChecked,
	{
		// disable type-aware linting on JS files
		files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
		...tseslint.configs.disableTypeChecked,
		rules: {
			...tseslint.configs.disableTypeChecked.rules,
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_(.+)' },
			],
		},
	},
	{
		files: ['*.mjs'],
		languageOptions: {
			sourceType: 'module',
		},
	},
	{
		files: ['**/*.tsx', '**/*.ts', '**/*.cts', '**/*.mts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/interface-name-prefix': 'off',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/promise-function-async': 'error',
			'@typescript-eslint/require-await': 'off', // conflicts with 'promise-function-async'

			/** Disable some annoyingly strict rules from the 'recommended-requiring-type-checking' pack */
			'@typescript-eslint/no-unsafe-assignment': 0,
			'@typescript-eslint/no-unsafe-member-access': 0,
			'@typescript-eslint/no-unsafe-argument': 0,
			'@typescript-eslint/no-unsafe-return': 0,
			'@typescript-eslint/no-unsafe-call': 0,
			'@typescript-eslint/restrict-template-expressions': 0,
			'@typescript-eslint/restrict-plus-operands': 0,
			'@typescript-eslint/no-redundant-type-constituents': 0,
			'@typescript-eslint/no-this-alias': 0, // Needed for some TRPC routers
			/** End 'recommended-requiring-type-checking' overrides */

			'@typescript-eslint/explicit-module-boundary-types': [
				'error',
				{
					allowedNames: [
						'createTrpcRouter', // The router wants to be inferred
					],
				},
			],
		},
	},
	{
		files: ['**/__tests__/**/*', 'test/**/*'],
		rules: {
			'@typescript-eslint/ban-ts-ignore': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
		},
	},
	{
		files: ['companion/**/*.ts', 'companion/**/*.js'],
		rules: {
			'n/no-missing-import': [
				'error',
				{
					allowModules: ['@companion-app/shared', '@companion-module/base', 'type-fest'],
				},
			],
		},
	},

	// Add prettier at the end to give it final say on formatting
	eslintPluginPrettierRecommended,
	{
		// But lastly, ensure that we ignore certain paths
		ignores: [
			'**/dist/*',
			'**/build/*',
			'/dist',
			'**/pkg/*',
			'**/docs/*',
			'**/generated/*',
			'**/node_modules/*',
			'**/electron-output/*',
			'*/vite.config.ts',
			'webui/vitest.config.ts',
			'vitest.config.ts',
			'vitest.workspace.ts',
			'html/**/*',
			'bundled-modules/**/*',
			'tools/**/*',
			'module-local-dev/**/*',
			'launcher/dev.cjs',
			'webui/public/_deps/**/*',
			// TMP
			'companion/lib/Cloud/**/*',
			'companion/test/**/*',
			'webui/test/**/*',
		],
	},
	{
		files: ['eslint.config.*'],
		rules: {
			'n/no-unpublished-import': 'off',
		},
	},

	// The above is mostly copied from https://github.com/bitfocus/companion-module-tools/blob/main/eslint/config.mjs with very little modifications. The below is extra rules that have been added
	{
		files: [
			'webui/**/*.tsx',
			'webui/**/*.jsx',
			'webui/**/*.ts',
			'webui/**/*.js',
			'launcher-ui/**/*.tsx',
			'launcher-ui/**/*.jsx',
			'launcher-ui/**/*.ts',
			'launcher-ui/**/*.js',
		],
		plugins: {
			'react-hooks': hookseslint,
			'react-refresh': reactRefreshEslint,
			react: reacteslint,
		},
		rules: {
			...hookseslint.configs.recommended.rules,
			'react-refresh/only-export-components': 'warn',
			'@typescript-eslint/only-throw-error': [
				'error',
				{
					allow: [
						{
							from: 'package',
							package: '@tanstack/router-core',
							name: 'Redirect',
						},
					],
				},
			],
		},
	},
	{
		rules: {
			'@typescript-eslint/no-namespace': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/no-duplicate-type-constituents': 'off',
		},
	},

	...pluginQuery.configs['flat/recommended'].map((config) => ({
		...config,
		files: ['webui/**/*.tsx', 'webui/**/*.jsx', 'webui/**/*.ts', 'webui/**/*.js'],
	})),
]
