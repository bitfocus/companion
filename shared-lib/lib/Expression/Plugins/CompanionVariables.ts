import * as acorn from 'acorn'
import { tokTypes } from 'acorn'

/**
 * AST node produced for a Companion variable reference `$(label:name)`.
 * The `name` is the raw inner string, kept opaque - the evaluator splits it on `:` exactly as before.
 */
export interface CompanionVariableExpression extends acorn.Node {
	type: 'CompanionVariable'
	name: string
}

const DOLLAR_CODE = 36 // $
const OPEN_PAREN_CODE = 40 // (

// A dedicated token type so `$(...)` is valid wherever an expression atom is valid
// (call args, array elements, arrow bodies, etc).
// Acorn's public types don't expose the TokenType constructor, so construct it via an `any` cast.
const companionVarTokenType = new (acorn.TokenType as any)('companionVar', { startsExpr: true })

/**
 * Acorn parser plugin that parses Companion's `$(label:name)` variable references natively.
 *
 * GOTCHA: we hook `readToken`, NOT `getTokenFromCode`. `$` is an identifier-start char, so acorn
 * routes it to `readWord` before `getTokenFromCode` runs - it would read `$` as an identifier and
 * then choke on the `:` inside. Intercepting in `readToken` runs early enough to grab the whole thing.
 */
export function companionVariablesAcornPlugin(BaseParser: typeof acorn.Parser): typeof acorn.Parser {
	// Acorn's public types don't expose the tokenizer internals (pos, finishToken, ...), so work against `any`.

	const Base = BaseParser as any

	return class CompanionVariableParser extends Base {
		readToken(code: number): any {
			// `$` immediately followed by `(` is the start of a Companion variable reference
			if (code === DOLLAR_CODE && this.input.charCodeAt(this.pos + 1) === OPEN_PAREN_CODE) {
				const close = this.input.indexOf(')', this.pos + 2)
				if (close === -1) this.raise(this.pos, 'Unterminated $( ) variable reference')

				// Inner string captured verbatim and opaque. Nested `$(...)` is unsupported, so the
				// first `)` always terminates - no balancing needed.
				const name = this.input.slice(this.pos + 2, close)
				this.pos = close + 1

				return this.finishToken(companionVarTokenType, name)
			}

			return super.readToken(code)
		}

		parseExprAtom(refDestructuringErrors?: any, ...rest: any[]): any {
			if (this.type === companionVarTokenType) {
				const node = this.startNode()
				node.name = this.value // raw inner string; evaluator splits on ':' as today
				this.next()
				return this.finishNode(node, 'CompanionVariable')
			}

			return super.parseExprAtom(refDestructuringErrors, ...rest)
		}

		parseStatement(context: any, topLevel: any, exports: any): any {
			// A top-level statement that starts with `{` is parsed as an object literal, not a block.
			// This is not a deliberate language rule: jsep (the previous parser) was expression-only and
			// could never produce a block, so `{...}` always meant an object. We preserve that for
			// backward compatibility - and because a leading object literal is meaningful as the
			// expression's (implicit) result value, e.g. `{ 1: 'on', 2: 'off' }[$(internal:state)]`.
			//
			// Gated to `topLevel`, so nested `{}` (e.g. `if`/`for`/`while` bodies, once control flow
			// lands) are still parsed as real blocks. The only thing given up is a bare standalone block
			// at the top level, which has no useful meaning in this dialect.
			if (topLevel && this.type === tokTypes.braceL) {
				const node = this.startNode()
				const expr = this.parseExpression()
				return this.parseExpressionStatement(node, expr)
			}

			return super.parseStatement(context, topLevel, exports)
		}

		parseMaybeUnary(refDestructuringErrors: any, sawUnary: any, incDec: any, forInit: any): any {
			// The dialect treats prefix `++`/`--` applied to a non-assignable operand as repeated unary
			// `+`/`-` (e.g. `--1` means `-(-1)`), rather than a syntax error. Only Identifier/MemberExpression
			// operands form a real increment/decrement.
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
