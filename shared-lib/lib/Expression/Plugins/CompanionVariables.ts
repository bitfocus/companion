import * as acorn from 'acorn'

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
	} as unknown as typeof acorn.Parser
}
