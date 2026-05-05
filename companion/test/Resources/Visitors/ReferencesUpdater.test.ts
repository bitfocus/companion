import { describe, expect, it } from 'vitest'
import { VisitorReferencesUpdaterVisitor } from '../../../lib/Resources/Visitors/ReferencesUpdater.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function exprVal<T>(value: T): { value: T; isExpression: false } {
	return { value, isExpression: false }
}

function exprExpr(value: string): { value: string; isExpression: true } {
	return { value, isExpression: true }
}

function makeUpdater(opts?: {
	labelRemap?: Record<string, string>
	idRemap?: Record<string, string>
}): VisitorReferencesUpdaterVisitor {
	return new VisitorReferencesUpdaterVisitor(opts?.labelRemap, opts?.idRemap)
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('VisitorReferencesUpdaterVisitor – constructor', () => {
	it('stores the provided remaps', () => {
		const labelRemap = { old: 'new' }
		const idRemap = { 'old-id': 'new-id' }
		const visitor = new VisitorReferencesUpdaterVisitor(labelRemap, idRemap)

		expect(visitor.connectionLabelsRemap).toBe(labelRemap)
		expect(visitor.connectionIdRemap).toBe(idRemap)
	})

	it('stores undefined remaps', () => {
		const visitor = new VisitorReferencesUpdaterVisitor(undefined, undefined)

		expect(visitor.connectionLabelsRemap).toBeUndefined()
		expect(visitor.connectionIdRemap).toBeUndefined()
	})

	it('starts with changed = false and empty changedFeedbackIds', () => {
		const visitor = makeUpdater()

		expect(visitor.changed).toBe(false)
		expect(visitor.changedFeedbackIds.size).toBe(0)
	})
})

// ─── visitConnectionId ───────────────────────────────────────────────────────

describe('VisitorReferencesUpdaterVisitor – visitConnectionId', () => {
	it('remaps a plain string id', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ conn: 'old-id' })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toBe('new-id')
		expect(visitor.changed).toBe(true)
	})

	it('leaves a plain string id unchanged when not in remap', () => {
		const visitor = makeUpdater({ idRemap: { 'other-id': 'new-id' } })
		const obj = structuredClone({ conn: 'my-id' })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toBe('my-id')
		expect(visitor.changed).toBe(false)
	})

	it('leaves a plain string id unchanged when remap maps it to itself', () => {
		const visitor = makeUpdater({ idRemap: { 'my-id': 'my-id' } })
		const obj = structuredClone({ conn: 'my-id' })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toBe('my-id')
		expect(visitor.changed).toBe(false)
	})

	it('does nothing when no idRemap is provided', () => {
		const visitor = makeUpdater({ idRemap: undefined })
		const obj = structuredClone({ conn: 'old-id' })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toBe('old-id')
		expect(visitor.changed).toBe(false)
	})

	it('remaps a number when the remap has a matching string key (type coercion)', () => {
		// Connection ids may be numbers; JS key coercion means remap['42'] hits key '42'
		const visitor = makeUpdater({ idRemap: { '42': 'new-id' } })
		const obj = structuredClone({ conn: 42 })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toBe('new-id')
		expect(visitor.changed).toBe(true)
	})

	it('does nothing for null', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ conn: null })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toBeNull()
		expect(visitor.changed).toBe(false)
	})

	it('tracks the feedbackId when a change is made', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ conn: 'old-id' })

		visitor.visitConnectionId(obj, 'conn', 'fb-1')

		expect(visitor.changedFeedbackIds).toEqual(new Set(['fb-1']))
	})

	it('does not add feedbackId when no change is made', () => {
		const visitor = makeUpdater({ idRemap: { 'other-id': 'new-id' } })
		const obj = structuredClone({ conn: 'my-id' })

		visitor.visitConnectionId(obj, 'conn', 'fb-1')

		expect(visitor.changedFeedbackIds.size).toBe(0)
	})

	it('skips the expression string when isExpression is true', () => {
		// An expression cannot be resolved to a connection id statically.
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ conn: exprExpr('some-expression') })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toEqual(exprExpr('some-expression'))
		expect(visitor.changed).toBe(false)
	})

	it('remaps a literal id wrapped in ExpressionOrValue (isExpression: false)', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ conn: exprVal('old-id') })

		visitor.visitConnectionId(obj, 'conn')

		expect(obj.conn).toEqual(exprVal('new-id'))
		expect(visitor.changed).toBe(true)
	})

	it('does not mutate connectionLabels-related state', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		visitor.visitConnectionId({ conn: 'old-id' }, 'conn')
		expect(visitor.connectionLabelsRemap).toBeUndefined()
	})
})

// ─── visitConnectionIdArray ──────────────────────────────────────────────────

describe('VisitorReferencesUpdaterVisitor – visitConnectionIdArray', () => {
	it('remaps all matching plain string ids in the array', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ ids: ['old-id', 'other-id', 'old-id'] })

		visitor.visitConnectionIdArray(obj, 'ids')

		expect(obj.ids).toEqual(['new-id', 'other-id', 'new-id'])
		expect(visitor.changed).toBe(true)
	})

	it('leaves an array unchanged when no ids match the remap', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ ids: ['a', 'b', 'c'] })

		visitor.visitConnectionIdArray(obj, 'ids')

		expect(obj.ids).toEqual(['a', 'b', 'c'])
		expect(visitor.changed).toBe(false)
	})

	it('handles an empty array without error', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ ids: [] })

		visitor.visitConnectionIdArray(obj, 'ids')

		expect(obj.ids).toEqual([])
		expect(visitor.changed).toBe(false)
	})

	it('does nothing when no idRemap is provided', () => {
		const visitor = makeUpdater({ idRemap: undefined })
		const obj = structuredClone({ ids: ['old-id'] })

		visitor.visitConnectionIdArray(obj, 'ids')

		expect(obj.ids).toEqual(['old-id'])
		expect(visitor.changed).toBe(false)
	})

	it('tracks the feedbackId when a change is made', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ ids: ['old-id'] })

		visitor.visitConnectionIdArray(obj, 'ids', 'fb-array')

		expect(visitor.changedFeedbackIds).toEqual(new Set(['fb-array']))
	})

	it('remaps ids inside an ExpressionOrValue-wrapped array (isExpression: false)', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ ids: exprVal(['old-id', 'other-id']) })

		visitor.visitConnectionIdArray(obj, 'ids')

		expect(obj.ids).toEqual(exprVal(['new-id', 'other-id']))
		expect(visitor.changed).toBe(true)
	})

	it('leaves an ExpressionOrValue-wrapped expression unchanged (isExpression: true)', () => {
		// An expression string can't be statically processed to extract array elements.
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })
		const obj = structuredClone({ ids: exprExpr('some-expression') })

		visitor.visitConnectionIdArray(obj, 'ids')

		expect(obj.ids).toEqual(exprExpr('some-expression'))
		expect(visitor.changed).toBe(false)
	})
})

// ─── visitString ─────────────────────────────────────────────────────────────

describe('VisitorReferencesUpdaterVisitor – visitString', () => {
	describe('fast path (single label remap entry)', () => {
		it('remaps the label in a variable reference', () => {
			const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
			const obj = structuredClone({ text: '$(oldconn:myvar)' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('$(newconn:myvar)')
			expect(visitor.changed).toBe(true)
		})

		it('remaps multiple occurrences of the same label', () => {
			const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
			const obj = structuredClone({ text: '$(oldconn:a) and $(oldconn:b)' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('$(newconn:a) and $(newconn:b)')
		})

		it('leaves the string unchanged when the label does not match', () => {
			const visitor = makeUpdater({ labelRemap: { other: 'newconn' } })
			const obj = structuredClone({ text: '$(oldconn:myvar)' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('$(oldconn:myvar)')
			expect(visitor.changed).toBe(false)
		})

		it('leaves a string with no variable references unchanged', () => {
			const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
			const obj = structuredClone({ text: 'hello world' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('hello world')
			expect(visitor.changed).toBe(false)
		})

		it('tracks feedbackId when changed', () => {
			const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
			visitor.visitString({ text: '$(oldconn:v)' }, 'text', 'fb-str')

			expect(visitor.changedFeedbackIds).toEqual(new Set(['fb-str']))
		})

		it('does not track feedbackId when unchanged', () => {
			const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
			visitor.visitString({ text: 'no variables here' }, 'text', 'fb-str')

			expect(visitor.changedFeedbackIds.size).toBe(0)
		})
	})

	describe('slow path (multiple label remap entries)', () => {
		it('remaps each matching label independently', () => {
			const visitor = makeUpdater({ labelRemap: { conn1: 'new1', conn2: 'new2' } })
			const obj = structuredClone({ text: '$(conn1:a) and $(conn2:b)' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('$(new1:a) and $(new2:b)')
			expect(visitor.changed).toBe(true)
		})

		it('leaves non-matching labels unchanged in a mixed string', () => {
			const visitor = makeUpdater({ labelRemap: { conn1: 'new1', conn2: 'new2' } })
			const obj = structuredClone({ text: '$(conn1:a) and $(unchanged:b)' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('$(new1:a) and $(unchanged:b)')
		})

		it('marks unchanged when no labels match', () => {
			const visitor = makeUpdater({ labelRemap: { conn1: 'new1', conn2: 'new2' } })
			const obj = structuredClone({ text: '$(other:a)' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('$(other:a)')
			expect(visitor.changed).toBe(false)
		})
	})

	describe('type handling', () => {
		it('does nothing when labelRemap is undefined', () => {
			const visitor = makeUpdater({ labelRemap: undefined })
			const obj = structuredClone({ text: '$(old:var)' })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe('$(old:var)')
			expect(visitor.changed).toBe(false)
		})

		it('ignores a plain non-string value (number)', () => {
			const visitor = makeUpdater({ labelRemap: { old: 'new' } })
			const obj = structuredClone({ text: 42 })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBe(42)
			expect(visitor.changed).toBe(false)
		})

		it('ignores null', () => {
			const visitor = makeUpdater({ labelRemap: { old: 'new' } })
			const obj = structuredClone({ text: null })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBeNull()
			expect(visitor.changed).toBe(false)
		})

		it('ignores undefined', () => {
			const visitor = makeUpdater({ labelRemap: { old: 'new' } })
			const obj = structuredClone({ text: undefined })

			visitor.visitString(obj, 'text')

			expect(obj.text).toBeUndefined()
			expect(visitor.changed).toBe(false)
		})

		it('remaps labels inside ExpressionOrValue (isExpression: false)', () => {
			const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
			const obj = structuredClone({ text: exprVal('$(oldconn:myvar)') })

			visitor.visitString(obj, 'text')

			expect(obj.text).toEqual(exprVal('$(newconn:myvar)'))
			expect(visitor.changed).toBe(true)
		})

		it('remaps labels inside ExpressionOrValue (isExpression: true)', () => {
			const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
			const obj = structuredClone({ text: exprExpr('$(oldconn:myvar) + 1') })

			visitor.visitString(obj, 'text')

			expect(obj.text).toEqual(exprExpr('$(newconn:myvar) + 1'))
			expect(visitor.changed).toBe(true)
		})
	})
})

// ─── visitVariableName ───────────────────────────────────────────────────────

describe('VisitorReferencesUpdaterVisitor – visitVariableName', () => {
	it('remaps the label and preserves the full variable name', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: 'oldconn:myvar' })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBe('newconn:myvar')
		expect(visitor.changed).toBe(true)
	})

	it('leaves the variable unchanged when the label does not match', () => {
		const visitor = makeUpdater({ labelRemap: { other: 'newconn' } })
		const obj = structuredClone({ v: 'oldconn:myvar' })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBe('oldconn:myvar')
		expect(visitor.changed).toBe(false)
	})

	it('leaves a string with no colon unchanged', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: 'nocolon' })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBe('nocolon')
		expect(visitor.changed).toBe(false)
	})

	it('leaves an empty string unchanged', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: '' })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBe('')
		expect(visitor.changed).toBe(false)
	})

	it('does nothing when labelRemap is undefined', () => {
		const visitor = makeUpdater({ labelRemap: undefined })
		const obj = structuredClone({ v: 'oldconn:myvar' })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBe('oldconn:myvar')
		expect(visitor.changed).toBe(false)
	})

	it('ignores a plain non-string number', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: 42 })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBe(42)
		expect(visitor.changed).toBe(false)
	})

	it('ignores null', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: null })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBeNull()
		expect(visitor.changed).toBe(false)
	})

	it('ignores undefined', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: undefined })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBeUndefined()
		expect(visitor.changed).toBe(false)
	})

	it('tracks feedbackId when changed', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		visitor.visitVariableName({ v: 'oldconn:myvar' }, 'v', 'fb-vn')

		expect(visitor.changedFeedbackIds).toEqual(new Set(['fb-vn']))
	})

	it('does not track feedbackId when unchanged', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		visitor.visitVariableName({ v: 'other:myvar' }, 'v', 'fb-vn')

		expect(visitor.changedFeedbackIds.size).toBe(0)
	})

	it('skips the expression string when isExpression is true', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: exprExpr('some-expression') })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toEqual(exprExpr('some-expression'))
		expect(visitor.changed).toBe(false)
	})

	it('remaps a literal variable name wrapped in ExpressionOrValue (isExpression: false)', () => {
		const visitor = makeUpdater({ labelRemap: { oldconn: 'newconn' } })
		const obj = structuredClone({ v: exprVal('oldconn:myvar') })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toEqual(exprVal('newconn:myvar'))
		expect(visitor.changed).toBe(true)
	})

	it('preserves the variable part after the first colon for multi-colon variable names', () => {
		// "a:b:c" → label "a" remapped → "new-a:b:c"
		const visitor = makeUpdater({ labelRemap: { a: 'new-a' } })
		const obj = structuredClone({ v: 'a:b:c' })

		visitor.visitVariableName(obj, 'v')

		expect(obj.v).toBe('new-a:b:c')
	})
})

// ─── changed / changedFeedbackIds tracking ───────────────────────────────────

describe('VisitorReferencesUpdaterVisitor – change tracking', () => {
	it('changed accumulates across multiple visit calls', () => {
		const visitor = makeUpdater({
			idRemap: { 'old-id': 'new-id' },
			labelRemap: { oldconn: 'newconn' },
		})

		visitor.visitConnectionId({ conn: 'irrelevant' }, 'conn')
		expect(visitor.changed).toBe(false)

		visitor.visitConnectionId({ conn: 'old-id' }, 'conn')
		expect(visitor.changed).toBe(true)
	})

	it('changedFeedbackIds accumulates distinct ids across calls', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })

		visitor.visitConnectionId({ conn: 'old-id' }, 'conn', 'fb-1')
		visitor.visitConnectionId({ conn: 'old-id' }, 'conn', 'fb-2')
		visitor.visitConnectionId({ conn: 'old-id' }, 'conn', 'fb-1') // duplicate

		expect(visitor.changedFeedbackIds).toEqual(new Set(['fb-1', 'fb-2']))
	})

	it('does not add feedbackId when feedbackId is undefined', () => {
		const visitor = makeUpdater({ idRemap: { 'old-id': 'new-id' } })

		visitor.visitConnectionId({ conn: 'old-id' }, 'conn', undefined)

		expect(visitor.changed).toBe(true)
		expect(visitor.changedFeedbackIds.size).toBe(0)
	})
})
