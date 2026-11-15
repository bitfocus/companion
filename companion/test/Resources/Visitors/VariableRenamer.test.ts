import { describe, expect, it } from 'vitest'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import { VisitorVariableRenamerVisitor } from '../../../lib/Resources/Visitors/VariableRenamer.js'

function makeRenamer(): VisitorVariableRenamerVisitor {
	return new VisitorVariableRenamerVisitor('options:old', 'options:new')
}

describe('VisitorVariableRenamerVisitor – visitString', () => {
	it('renames every reference in a plain value', () => {
		const visitor = makeRenamer()
		const obj = { text: exprVal('$(options:old) and $(options:old)') }

		visitor.visitString(obj, 'text', 'fb-1')

		expect(obj.text).toEqual(exprVal('$(options:new) and $(options:new)'))
		expect(visitor.changed).toBe(true)
		expect(visitor.changedFeedbackIds).toEqual(new Set(['fb-1']))
	})

	it('renames a reference in an expression', () => {
		const visitor = makeRenamer()
		const obj = { text: exprExpr('$(options:old) + 1') }

		visitor.visitString(obj, 'text')

		expect(obj.text).toEqual(exprExpr('$(options:new) + 1'))
	})

	it('renames a reference in an unwrapped value', () => {
		const visitor = makeRenamer()
		const obj = { text: 'value $(options:old)' }

		visitor.visitString(obj, 'text')

		expect(obj.text).toBe('value $(options:new)')
	})

	it('leaves other variables alone, including one whose name starts the same', () => {
		const visitor = makeRenamer()
		const obj = { text: exprVal('$(options:older) $(local:old) $(custom:old)') }

		visitor.visitString(obj, 'text', 'fb-1')

		expect(obj.text).toEqual(exprVal('$(options:older) $(local:old) $(custom:old)'))
		expect(visitor.changed).toBe(false)
		expect(visitor.changedFeedbackIds.size).toBe(0)
	})

	it('leaves a value which is not a string alone', () => {
		const visitor = makeRenamer()
		const obj = { count: exprVal(5) }

		visitor.visitString(obj, 'count')

		expect(obj.count).toEqual(exprVal(5))
		expect(visitor.changed).toBe(false)
	})
})

describe('VisitorVariableRenamerVisitor – visitVariableName', () => {
	it('renames a variable name which is the variable', () => {
		const visitor = makeRenamer()
		const obj = { variable: exprVal('options:old') }

		visitor.visitVariableName(obj, 'variable', 'fb-1')

		expect(obj.variable).toEqual(exprVal('options:new'))
		expect(visitor.changedFeedbackIds).toEqual(new Set(['fb-1']))
	})

	it('leaves another variable name, and an expression, alone', () => {
		const visitor = makeRenamer()
		const obj = { a: exprVal('options:older'), b: exprExpr('options:old') }

		visitor.visitVariableName(obj, 'a')
		visitor.visitVariableName(obj, 'b')

		expect(obj).toEqual({ a: exprVal('options:older'), b: exprExpr('options:old') })
		expect(visitor.changed).toBe(false)
	})
})

describe('VisitorVariableRenamerVisitor – ids', () => {
	it('leaves connection and surface ids alone', () => {
		const visitor = makeRenamer()
		const obj = { connectionId: 'options:old', connectionIds: ['options:old'], surfaceId: 'options:old' }

		visitor.visitConnectionId(obj, 'connectionId')
		visitor.visitConnectionIdArray(obj, 'connectionIds')
		visitor.visitOutboundSurfaceId(obj, 'surfaceId')

		expect(obj).toEqual({ connectionId: 'options:old', connectionIds: ['options:old'], surfaceId: 'options:old' })
		expect(visitor.changed).toBe(false)
	})
})
