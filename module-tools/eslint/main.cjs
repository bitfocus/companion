const {
	commonPlugins,
	tsPlugins,
	commonExtends,
	tsExtends,
	commonRules,
	tsRules,
	tsParser,
	enableJest,
} = require('./fragments.cjs')

const disableJest = enableJest
	? {
			'jest/globals': false, // Block jest from this
	  }
	: {}
const allowJest = enableJest
	? {
			'jest/globals': true,
			jest: true,
	  }
	: {}

module.exports = {
	extends: commonExtends,
	plugins: commonPlugins,
	rules: {
		'prettier/prettier': 'error',
	},
	env: { es2017: true },
	parserOptions: { sourceType: 'module', ecmaVersion: 2018 },
	overrides: [
		// Note: these replace the values defined above, so make sure to extend them if they are needed
		{
			files: ['*.ts'],
			extends: tsExtends,
			plugins: tsPlugins,
			...tsParser,
			env: {
				...disableJest,
			},
			rules: {
				...commonRules,
				...tsRules,
			},
		},
		{
			files: ['*.js'],
			settings: {
				node: {
					tryExtensions: ['.js', '.json', '.node', '.ts'],
				},
			},
			env: {
				...disableJest,
			},
			rules: {
				...commonRules,
			},
		},
		{
			files: ['src/**/__tests__/**/*.ts'],
			extends: tsExtends,
			plugins: tsPlugins,
			...tsParser,
			env: {
				...allowJest,
			},
			rules: {
				...commonRules,
				...tsRules,
				'@typescript-eslint/ban-ts-ignore': 'off',
				'@typescript-eslint/ban-ts-comment': 'off',
			},
		},
		{
			files: ['examples/**/*.ts'],
			extends: tsExtends,
			plugins: tsPlugins,
			...tsParser,
			env: {
				...disableJest,
			},
			rules: {
				...commonRules,
				...tsRules,
				'no-process-exit': 'off',
				'node/no-missing-import': 'off',
			},
		},
	],
}
