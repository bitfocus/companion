const enableJest = false // TODO

function compact(arr) {
	return arr.filter((v) => v !== undefined && v !== null)
}

module.exports = {
	enableJest,

	commonPlugins: compact(['prettier', enableJest ? 'jest' : null]),
	tsPlugins: compact(['@typescript-eslint', 'prettier', enableJest ? 'jest' : null]),

	commonExtends: ['eslint:recommended', 'plugin:node/recommended', 'plugin:prettier/recommended'],
	tsExtends: compact([
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking',
		'plugin:node/recommended',
		enableJest ? 'plugin:jest/recommended' : null,
		'prettier',
		'plugin:prettier/recommended',
	]),

	commonRules: {
		'prettier/prettier': 'error',
		'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_(.+)' }],
		'no-extra-semi': 'off',
		'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
		'no-use-before-define': 'off',
		'no-warning-comments': ['error', { terms: ['nocommit', '@nocommit', '@no-commit'] }],
		'jest/no-mocks-import': 'off',
	},
	tsRules: {
		'no-unused-vars': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/interface-name-prefix': 'off',
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_(.+)' }],
		'@typescript-eslint/no-floating-promises': 'error',
		'@typescript-eslint/explicit-module-boundary-types': ['error'],
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
		/** End 'recommended-requiring-type-checking' overrides */
	},

	tsParser: {
		parser: '@typescript-eslint/parser',
		parserOptions: { project: './tsconfig.json' },
		settings: {
			node: {
				tryExtensions: ['.js', '.json', '.node', '.ts', '.d.ts'],
			},
		},
	},
}
