import { describe, it, expect } from 'vitest'
import { VisitorReferencesCollectorVisitor } from '../../../lib/Resources/Visitors/ReferencesCollector.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Wrap a plain value in ExpressionOrValue (isExpression: false) */
function exprVal<T>(value: T): { value: T; isExpression: false } {
	return { value, isExpression: false }
}

/** Wrap a string expression in ExpressionOrValue (isExpression: true) */
function exprExpr(value: string): { value: string; isExpression: true } {
	return { value, isExpression: true }
}

/** Build a fresh visitor with externally-observable sets */
function makeVisitor(opts?: {
	ids?: Set<string>
	labels?: Set<string>
	variables?: Set<string>
}): VisitorReferencesCollectorVisitor {
	return new VisitorReferencesCollectorVisitor(opts?.ids, opts?.labels, opts?.variables)
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('VisitorReferencesCollectorVisitor – constructor', () => {
	it('uses the provided sets directly', () => {
		const ids = new Set<string>(['existing-id'])
		const labels = new Set<string>(['existing-label'])
		const variables = new Set<string>(['existing-label:var'])

		const visitor = new VisitorReferencesCollectorVisitor(ids, labels, variables)

		expect(visitor.connectionIds).toBe(ids)
		expect(visitor.connectionLabels).toBe(labels)
		expect(visitor.variables).toBe(variables)
	})

	it('creates fresh sets when all arguments are undefined', () => {
		const visitor = new VisitorReferencesCollectorVisitor(undefined, undefined, undefined)

		expect(visitor.connectionIds).toBeInstanceOf(Set)
		expect(visitor.connectionLabels).toBeInstanceOf(Set)
		expect(visitor.variables).toBeInstanceOf(Set)
		expect(visitor.connectionIds.size).toBe(0)
		expect(visitor.connectionLabels.size).toBe(0)
		expect(visitor.variables.size).toBe(0)
	})

	it('creates fresh sets independently for each undefined argument', () => {
		const ids = new Set<string>()
		const visitor = new VisitorReferencesCollectorVisitor(ids, undefined, undefined)

		expect(visitor.connectionIds).toBe(ids)
		expect(visitor.connectionLabels).toBeInstanceOf(Set)
		expect(visitor.variables).toBeInstanceOf(Set)
	})
})

// ─── visitConnectionId ───────────────────────────────────────────────────────

describe('VisitorReferencesCollectorVisitor – visitConnectionId', () => {
	it('adds a plain string value to connectionIds', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: 'abc123' }, 'conn')
		expect(visitor.connectionIds).toEqual(new Set(['abc123']))
	})

	it('ignores a plain non-string value (number)', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: 42 }, 'conn')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('ignores null', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: null }, 'conn')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('ignores undefined', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: undefined }, 'conn')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('ignores a plain array value', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: ['a', 'b'] }, 'conn')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('unwraps ExpressionOrValue (isExpression: false) with a string value', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: exprVal('unwrapped-id') }, 'conn')
		expect(visitor.connectionIds).toEqual(new Set(['unwrapped-id']))
	})

	it('ignores ExpressionOrValue (isExpression: false) with a non-string value', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: exprVal(99) }, 'conn')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('skips the value when isExpression is true (expression cannot be a connection id)', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: exprExpr("concat('some', '_conn')") }, 'conn')
		// Expression strings cannot be statically resolved to a connection id,
		// so the implementation correctly ignores them.
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('does not mutate connectionLabels or variables', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ conn: 'id-1' }, 'conn')
		expect(visitor.connectionLabels.size).toBe(0)
		expect(visitor.variables.size).toBe(0)
	})
})

// ─── visitConnectionIdArray ──────────────────────────────────────────────────

describe('VisitorReferencesCollectorVisitor – visitConnectionIdArray', () => {
	it('adds all string elements of a plain array', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: ['a', 'b', 'c'] }, 'ids')
		expect(visitor.connectionIds).toEqual(new Set(['a', 'b', 'c']))
	})

	it('skips non-string elements within the array', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: ['valid', 42, null, 'also-valid', undefined] }, 'ids')
		expect(visitor.connectionIds).toEqual(new Set(['valid', 'also-valid']))
	})

	it('ignores a plain string value (not an array)', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: 'not-an-array' }, 'ids')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('ignores a plain number value', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: 5 }, 'ids')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('handles an empty array', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: [] }, 'ids')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('unwraps ExpressionOrValue (isExpression: false) wrapping an array', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: exprVal(['x', 'y']) }, 'ids')
		expect(visitor.connectionIds).toEqual(new Set(['x', 'y']))
	})

	it('ignores ExpressionOrValue (isExpression: false) wrapping a non-array', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: exprVal('not-an-array') }, 'ids')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('skips when isExpression is true (expression cannot be a connection id array)', () => {
		// When isExpression is true the value is always a string (the expression
		// source).  Even if it evaluated to an array, individual elements could
		// themselves be expressions rather than literal ids, so no ids can be
		// reliably extracted statically.
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: exprExpr("['conn-a', 'conn-b']") }, 'ids')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('does not mutate connectionLabels or variables', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionIdArray({ ids: ['a'] }, 'ids')
		expect(visitor.connectionLabels.size).toBe(0)
		expect(visitor.variables.size).toBe(0)
	})
})

// ─── visitString ─────────────────────────────────────────────────────────────

describe('VisitorReferencesCollectorVisitor – visitString', () => {
	it('does nothing for a string with no variable references', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: 'hello world' }, 'text')
		expect(visitor.connectionLabels.size).toBe(0)
		expect(visitor.variables.size).toBe(0)
	})

	it('collects a single variable reference from a plain string', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: '$(myconn:myprop)' }, 'text')
		expect(visitor.connectionLabels).toEqual(new Set(['myconn']))
		expect(visitor.variables).toEqual(new Set(['myconn:myprop']))
	})

	it('collects multiple variable references from a plain string', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: 'Hello $(conn1:var1) and $(conn2:var2)!' }, 'text')
		expect(visitor.connectionLabels).toEqual(new Set(['conn1', 'conn2']))
		expect(visitor.variables).toEqual(new Set(['conn1:var1', 'conn2:var2']))
	})

	it('collects duplicate references only once (Set deduplication)', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: '$(a:x) $(a:x) $(a:x)' }, 'text')
		expect(visitor.connectionLabels.size).toBe(1)
		expect(visitor.variables.size).toBe(1)
	})

	it('ignores a plain non-string value (number)', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: 42 }, 'text')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('ignores null', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: null }, 'text')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('ignores undefined', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: undefined }, 'text')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('unwraps ExpressionOrValue (isExpression: false) with a string value', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: exprVal('$(conn:var)') }, 'text')
		expect(visitor.connectionLabels).toEqual(new Set(['conn']))
		expect(visitor.variables).toEqual(new Set(['conn:var']))
	})

	it('ignores ExpressionOrValue (isExpression: false) with a non-string value', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: exprVal(123) }, 'text')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('extracts variable references from the raw expression text when isExpression is true', () => {
		// The expression string is never evaluated here; the collector finds
		// any $(label:var) substrings in the expression source.
		const visitor = makeVisitor()
		visitor.visitString({ text: exprExpr('$(conn:var) + 1') }, 'text')
		expect(visitor.connectionLabels).toEqual(new Set(['conn']))
		expect(visitor.variables).toEqual(new Set(['conn:var']))
	})

	it('does not collect variables for a plain variable reference without proper syntax', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: 'conn:var' }, 'text') // no $() wrapper
		expect(visitor.variables.size).toBe(0)
	})

	it('does not mutate connectionIds', () => {
		const visitor = makeVisitor()
		visitor.visitString({ text: '$(conn:var)' }, 'text')
		expect(visitor.connectionIds.size).toBe(0)
	})
})

// ─── visitVariableName ───────────────────────────────────────────────────────

describe('VisitorReferencesCollectorVisitor – visitVariableName', () => {
	it('collects label and variable from a plain "label:var" string', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: 'myconn:myvar' }, 'v')
		expect(visitor.connectionLabels).toEqual(new Set(['myconn']))
		expect(visitor.variables).toEqual(new Set(['myconn:myvar']))
	})

	it('ignores a string that contains no colon (invalid variable id)', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: 'justlabel' }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
		expect(visitor.variables.size).toBe(0)
	})

	it('ignores an empty string', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: '' }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('ignores a plain non-string value (number)', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: 42 }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('ignores null', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: null }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('ignores undefined', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: undefined }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('unwraps ExpressionOrValue (isExpression: false) with a valid variable string', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: exprVal('conn:var') }, 'v')
		expect(visitor.connectionLabels).toEqual(new Set(['conn']))
		expect(visitor.variables).toEqual(new Set(['conn:var']))
	})

	it('ignores ExpressionOrValue (isExpression: false) with a non-string value', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: exprVal(0) }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('ignores ExpressionOrValue (isExpression: false) wrapping an invalid variable string', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: exprVal('nocolon') }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
	})

	it('skips the value when isExpression is true (expression cannot be a variable name)', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: exprExpr('$(internal:some_var)') }, 'v')
		// Expression strings cannot be statically resolved to a variable name.
		// Previously TrySplitVariableId would mangle the expression string
		// (producing a label of "$(internal"); the implementation now correctly
		// ignores expression values entirely.
		expect(visitor.connectionLabels.size).toBe(0)
		expect(visitor.variables.size).toBe(0)
	})

	it('when isExpression is true and expression has no colon, nothing is added', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: exprExpr('someFunction()') }, 'v')
		expect(visitor.connectionLabels.size).toBe(0)
		expect(visitor.variables.size).toBe(0)
	})

	it('does not mutate connectionIds', () => {
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: 'conn:var' }, 'v')
		expect(visitor.connectionIds.size).toBe(0)
	})

	it('uses the first colon as separator (rest of string becomes variable part)', () => {
		// "a:b:c" → label="a", full variable="a:b:c"
		const visitor = makeVisitor()
		visitor.visitVariableName({ v: 'a:b:c' }, 'v')
		expect(visitor.connectionLabels).toEqual(new Set(['a']))
		expect(visitor.variables).toEqual(new Set(['a:b:c']))
	})
})

// ─── External-set integration ─────────────────────────────────────────────────

describe('VisitorReferencesCollectorVisitor – shared external sets', () => {
	it('mutates the caller-supplied sets so results are visible externally', () => {
		const ids = new Set<string>()
		const labels = new Set<string>()
		const vars = new Set<string>()

		const visitor = new VisitorReferencesCollectorVisitor(ids, labels, vars)
		visitor.visitConnectionId({ id: 'ext-id' }, 'id')
		visitor.visitString({ text: '$(ext-conn:ext-var)' }, 'text')
		visitor.visitVariableName({ v: 'ext-conn2:ext-var2' }, 'v')

		expect(ids).toEqual(new Set(['ext-id']))
		expect(labels).toEqual(new Set(['ext-conn', 'ext-conn2']))
		expect(vars).toEqual(new Set(['ext-conn:ext-var', 'ext-conn2:ext-var2']))
	})

	it('accumulates across multiple visit calls', () => {
		const visitor = makeVisitor()
		visitor.visitConnectionId({ a: 'id-1' }, 'a')
		visitor.visitConnectionId({ b: 'id-2' }, 'b')
		visitor.visitConnectionIdArray({ c: ['id-3', 'id-4'] }, 'c')

		expect(visitor.connectionIds).toEqual(new Set(['id-1', 'id-2', 'id-3', 'id-4']))
	})
})
