import { builtinFunctionCompletions } from '../Expression.monarch.js'
import { ExpressionFunctions } from '@companion-app/shared/Expression/ExpressionFunctions.js'
import { describe, test, expect } from 'vitest'

describe('Ensure all functions are documented', () => {
	for (const funcName of Object.keys(ExpressionFunctions)) {
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
	])

	for (const funcDocs of builtinFunctionCompletions) {
		if (ignoreFunctions.has(funcDocs.name)) continue

		test(`Function "${funcDocs.name}" exists`, () => {
			expect(ExpressionFunctions[funcDocs.name]).toBeDefined()
		})
	}
})
