module.exports = {
	moduleFileExtensions: ['ts', 'js'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
			},
		],
	},
	testMatch: ['**/__tests__/**/*.spec.(ts|js)'],
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0,
		},
	},
	coverageDirectory: './coverage/',
	collectCoverage: false,
	collectCoverageFrom: [
		'src/**/*.{js,ts}',
		'!**/@types/**',
		'!**/__tests__/**',
		'!**/__mocks__/**',
		'!**/node_modules/**',
		'!**/dist/**',
	],
}
