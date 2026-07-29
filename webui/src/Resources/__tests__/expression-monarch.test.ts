import { describe, expect, test } from 'vitest'
import { BuiltinFunctionNames } from '@companion-app/shared/Expressions.js'
import { builtinFunctionCompletions } from '../Expression.monarch.js'

describe('Ensure all functions are documented', () => {
	for (const funcName of BuiltinFunctionNames) {
		test(`Function "${funcName}" is documented`, () => {
			expect(builtinFunctionCompletions.find((c) => c.name === funcName)).toBeDefined()
		})
	}
})

describe('Ensure all documentation references real functions', () => {
	const ignoreFunctions = new Set<string>([
		// Some functions are implemented elsewhere
		'parseVariables',
		'getVariable',
		'blink',
		'oscillate',
	])

	for (const funcDocs of builtinFunctionCompletions) {
		if (ignoreFunctions.has(funcDocs.name)) continue

		test(`Function "${funcDocs.name}" exists`, () => {
			expect(BuiltinFunctionNames.includes(funcDocs.name)).toBeDefined()
		})
	}
})
