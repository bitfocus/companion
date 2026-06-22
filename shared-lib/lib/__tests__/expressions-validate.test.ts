import { describe, expect, it } from 'vitest'
import { ParseExpression } from '../Expression/ExpressionParse.js'

// ParseExpression runs the validation pass, so a rejected expression throws here.
function accepts(expr: string): boolean {
	try {
		ParseExpression(expr)
		return true
	} catch {
		return false
	}
}

function rejectionMessage(expr: string): string | undefined {
	try {
		ParseExpression(expr)
		return undefined
	} catch (e) {
		return (e as Error).message
	}
}

describe('expression validation (subset by rejection)', () => {
	describe('accepts the supported dialect', () => {
		const supported = [
			'1 + 2 * 3 - 4 / 5 % 6',
			'2 ** 8',
			'5 & 3 | 1 ^ 2',
			'1 << 4 >> 2',
			'1 < 2 && 3 >= 2 || 4 === 4',
			'null ?? 5',
			'!true',
			'~5',
			'-(-1)',
			'a = 1; b = 2; return a + b',
			'let a = 5; const b = 6; a + b',
			'a = 1; a += 2; a *= 3; a',
			'x = 5; ++x; x--; x',
			'a ||= 1; a &&= 2; a ??= 3',
			'1 > 2 ? 3 : 4',
			'[1, 2, 3, [4, 5]]',
			"{ a: 1, 'b': 2, c: { d: 3 }, [`x`]: 4 }",
			"$(internal:foo) + $(other:bar)['baz']",
			'$(my:obj).prop',
			'`template ${1 + 2} string`',
			'round(1.5)',
			'max(1, 2, 3)',
			'(1, 2, 3)',
			'return 5',
			'undefined',
			'null',
		]
		for (const expr of supported) {
			it(`accepts: ${JSON.stringify(expr)}`, () => {
				expect(accepts(expr)).toBe(true)
			})
		}
	})

	describe('rejects unsupported syntax', () => {
		const rejected: Array<[string, RegExp]> = [
			// functions
			['x => x + 1', /Unsupported syntax "ArrowFunctionExpression"/],
			['function f() { return 1 }', /Unsupported syntax "FunctionDeclaration"/],
			['(function () { return 1 })', /Unsupported syntax "FunctionExpression"/],

			// control flow (planned for a later phase, not supported yet)
			['if (1) { 2 }', /Unsupported syntax "IfStatement"/],
			['for (;;) { 1 }', /Unsupported syntax "ForStatement"/],
			['while (true) { 1 }', /Unsupported syntax "WhileStatement"/],
			['for (const x of [1]) { x }', /Unsupported syntax "ForOfStatement"/],

			// error handling / classes / modules
			['try { 1 } catch (e) { 2 }', /Unsupported syntax "TryStatement"/],
			['throw 1', /Unsupported syntax "ThrowStatement"/],
			['class A {}', /Unsupported syntax "ClassDeclaration"/],
			['new Date()', /Unsupported syntax "NewExpression"/],

			// disallowed operators
			['typeof 5', /Unsupported unary operator "typeof"/],
			['void 0', /Unsupported unary operator "void"/],
			['delete a.b', /Unsupported unary operator "delete"/],
			['5 >>> 1', /Unsupported binary operator ">>>"/],
			['1 in {}', /Unsupported binary operator "in"/],
			['a instanceof b', /Unsupported binary operator "instanceof"/],
			['a >>>= 1', /Unsupported assignment operator ">>>="/],

			// literals
			['/abc/', /Regular expression literals are not supported/],
			['123n', /BigInt literals are not supported/],

			// member/call restrictions
			['a?.b', /Optional chaining/],
			['[].map(x)', /Only direct function calls are supported/],

			// declarations
			['var a = 1', /Unsupported variable declaration "var"/],
			['const [a, b] = c', /Destructuring declarations are not supported/],

			// spread / objects
			['[...a]', /Spread \(`\.\.\.`\) is not supported/],
			['({ ...a })', /Spread \(`\.\.\.`\) is not supported/],
		]
		for (const [expr, pattern] of rejected) {
			it(`rejects: ${JSON.stringify(expr)}`, () => {
				const message = rejectionMessage(expr)
				expect(message).toBeDefined()
				expect(message).toMatch(pattern)
			})
		}

		it('includes a character position in the error', () => {
			expect(rejectionMessage('1 + typeof 5')).toMatch(/at character 4/)
		})
	})
})
