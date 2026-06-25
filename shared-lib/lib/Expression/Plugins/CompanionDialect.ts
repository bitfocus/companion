import type * as acorn from 'acorn'
import { tokTypes } from 'acorn'

/**
 * Deviations from standard JavaScript that define Companion's expression dialect, beyond the `$(...)`
 * variable syntax (which lives in ./CompanionVariables.ts).
 *
 * Each quirk is its own small, single-method acorn plugin so its intent and scope are self-evident.
 * They override disjoint parser methods, so the order they are composed in does not matter.
 */

/**
 * Top-level `{` is parsed as an object literal, not a block statement.
 *
 * This is not a deliberate language rule: jsep (the previous parser) was expression-only and could
 * never produce a block, so `{...}` always meant an object. We preserve that for backward
 * compatibility - and because a leading object literal is meaningful as the expression's (implicit)
 * result value, e.g. `{ 1: 'on', 2: 'off' }[$(internal:state)]`.
 *
 * Gated to `topLevel`, so nested `{}` (e.g. `if`/`for`/`while` bodies) are still parsed as real
 * blocks. The only thing given up is a bare standalone block at the top level, which has no useful
 * meaning in this dialect.
 */
export function topLevelObjectLiteralAcornPlugin(BaseParser: typeof acorn.Parser): typeof acorn.Parser {
	const Base = BaseParser as any

	return class TopLevelObjectLiteralParser extends Base {
		parseStatement(context: any, topLevel: any, exports: any): any {
			if (topLevel && this.type === tokTypes.braceL) {
				const node = this.startNode()
				const expr = this.parseExpression()
				return this.parseExpressionStatement(node, expr)
			}

			return super.parseStatement(context, topLevel, exports)
		}
	} as unknown as typeof acorn.Parser
}

/**
 * Prefix `++`/`--` applied to a non-assignable operand is treated as repeated unary `+`/`-`
 * (e.g. `--1` means `-(-1)`), rather than a syntax error. Only Identifier/MemberExpression operands
 * form a real increment/decrement.
 */
export function repeatedUnaryAcornPlugin(BaseParser: typeof acorn.Parser): typeof acorn.Parser {
	const Base = BaseParser as any

	return class RepeatedUnaryParser extends Base {
		parseMaybeUnary(refDestructuringErrors: any, sawUnary: any, incDec: any, forInit: any): any {
			if (this.type === tokTypes.incDec) {
				const node = this.startNode()
				const operator: string = this.value
				node.prefix = true
				this.next()
				const argument = this.parseMaybeUnary(null, true, true, forInit)

				if (argument.type === 'Identifier' || argument.type === 'MemberExpression') {
					node.operator = operator
					node.argument = argument
					this.checkLValSimple(argument)
					return this.finishNode(node, 'UpdateExpression')
				}

				// Rebuild as two nested unary expressions: `--x` -> `-(-x)`, `++x` -> `+(+x)`
				const unaryOperator = operator[0]
				const inner = this.startNodeAt(node.start)
				inner.operator = unaryOperator
				inner.prefix = true
				inner.argument = argument
				const innerNode = this.finishNode(inner, 'UnaryExpression')

				const outer = this.startNodeAt(node.start)
				outer.operator = unaryOperator
				outer.prefix = true
				outer.argument = innerNode
				return this.finishNode(outer, 'UnaryExpression')
			}

			return super.parseMaybeUnary(refDestructuringErrors, sawUnary, incDec, forInit)
		}
	} as unknown as typeof acorn.Parser
}

/**
 * A template literal on a new line must NOT be consumed as a tagged template of the preceding
 * expression.
 *
 * JS ASI does not break before a backtick (a backtick continues the expression), so
 * `a = 1` <newline> `` `x` `` parses as the tagged template `` a = 1`x` `` - which this dialect
 * rejects, surprising users who expect two separate statements. When a newline precedes the backtick,
 * stop the subscript chain so ASI splits the statements as intended.
 *
 * A backtick on the *same* line still parses as a tagged template and is rejected by validation with
 * a friendly message, so genuine mistakes keep their clear error.
 */
export function templateLiteralAsiAcornPlugin(BaseParser: typeof acorn.Parser): typeof acorn.Parser {
	const Base = BaseParser as any

	return class TemplateLiteralAsiParser extends Base {
		parseSubscript(
			base: any,
			startPos: any,
			startLoc: any,
			noCalls: any,
			maybeAsyncArrow: any,
			optionalChained: any,
			forInit: any
		): any {
			if (this.type === tokTypes.backQuote && this.canInsertSemicolon()) {
				return base
			}

			return super.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit)
		}
	} as unknown as typeof acorn.Parser
}
