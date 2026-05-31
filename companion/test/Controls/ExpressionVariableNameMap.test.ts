import { beforeEach, describe, expect, test, vi } from 'vitest'
// Import the mocked class so test instances pass instanceof checks in the source
import { ControlExpressionVariable } from '../../lib/Controls/ControlTypes/ExpressionVariable.js'
import { ExpressionVariableNameMap } from '../../lib/Controls/ExpressionVariableNameMap.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Must be hoisted above imports. Provides a stub class so that `instanceof
// ControlExpressionVariable` in rebuildMap() works with our fake instances.
vi.mock('../../lib/Controls/ControlTypes/ExpressionVariable.js', () => {
	class ControlExpressionVariable {
		controlId: string
		options: { variableName: string }
		triggerRedraw: ReturnType<typeof vi.fn>

		constructor(controlId: string, variableName: string) {
			this.controlId = controlId
			this.options = { variableName }
			this.triggerRedraw = vi.fn()
		}
	}
	return { ControlExpressionVariable }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCveControl(controlId: string, variableName: string): InstanceType<typeof ControlExpressionVariable> {
	return new (ControlExpressionVariable as any)(controlId, variableName)
}

function makeMap() {
	const variableValuesController = { setVariableValues: vi.fn() }
	const controls = new Map<string, any>()
	const map = new ExpressionVariableNameMap(variableValuesController as any, controls)
	return { map, controls, variableValuesController }
}

// ── addExpressionVariable ─────────────────────────────────────────────────────

describe('addExpressionVariable', () => {
	test('first control with a name becomes active', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		expect(map.getControlIdByName('myVar')).toBe('ctrl-1')
	})

	test('adding same control twice is a no-op (still the only active)', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		map.addExpressionVariable('ctrl-1', 'myVar')
		expect(map.getControlIdByName('myVar')).toBe('ctrl-1')
	})

	test('second control with the same name is queued as a conflict', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		map.addExpressionVariable('ctrl-2', 'myVar')
		// Active is still ctrl-1
		expect(map.getControlIdByName('myVar')).toBe('ctrl-1')
		// ctrl-2 is a conflict — verify by removing ctrl-1 and seeing ctrl-2 promoted
		// (tested via removeExpressionVariable below; here just confirm active is ctrl-1)
	})

	test('empty variableName is a no-op', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', '')
		expect(map.getControlIdByName('')).toBeUndefined()
	})
})

// ── removeExpressionVariable ──────────────────────────────────────────────────

describe('removeExpressionVariable', () => {
	test('removing the only active control deletes the entry and calls setVariableValues', () => {
		const { map, variableValuesController } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		map.removeExpressionVariable('ctrl-1', 'myVar')

		expect(map.getControlIdByName('myVar')).toBeUndefined()
		expect(variableValuesController.setVariableValues).toHaveBeenCalledWith('expression', [
			{ id: 'myVar', value: undefined },
		])
	})

	test('removing active control promotes the first conflict and calls triggerRedraw', () => {
		const { map, controls } = makeMap()

		const ctrl2 = makeCveControl('ctrl-2', 'myVar')
		controls.set('ctrl-2', ctrl2)

		map.addExpressionVariable('ctrl-1', 'myVar')
		map.addExpressionVariable('ctrl-2', 'myVar')

		map.removeExpressionVariable('ctrl-1', 'myVar')

		expect(map.getControlIdByName('myVar')).toBe('ctrl-2')
		expect(ctrl2.triggerRedraw).toHaveBeenCalledOnce()
	})

	test('removing a non-active conflict just removes it from the queue', () => {
		const { map, variableValuesController } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		map.addExpressionVariable('ctrl-2', 'myVar')

		map.removeExpressionVariable('ctrl-2', 'myVar')

		// ctrl-1 is still active, setVariableValues not called
		expect(map.getControlIdByName('myVar')).toBe('ctrl-1')
		expect(variableValuesController.setVariableValues).not.toHaveBeenCalled()
	})

	test('removing a non-existent entry is a no-op', () => {
		const { map, variableValuesController } = makeMap()
		expect(() => map.removeExpressionVariable('ctrl-x', 'noSuchVar')).not.toThrow()
		expect(variableValuesController.setVariableValues).not.toHaveBeenCalled()
	})

	test('empty variableName is a no-op', () => {
		const { map, variableValuesController } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		map.removeExpressionVariable('ctrl-1', '')
		expect(map.getControlIdByName('myVar')).toBe('ctrl-1')
		expect(variableValuesController.setVariableValues).not.toHaveBeenCalled()
	})
})

// ── updateExpressionVariableName ──────────────────────────────────────────────

describe('updateExpressionVariableName', () => {
	test('renames the active control: old name gone, new name active', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', 'oldVar')
		map.updateExpressionVariableName('ctrl-1', 'oldVar', 'newVar')

		expect(map.getControlIdByName('oldVar')).toBeUndefined()
		expect(map.getControlIdByName('newVar')).toBe('ctrl-1')
	})

	test('renaming to a conflicting name queues the control', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', 'varA')
		map.addExpressionVariable('ctrl-2', 'varB')

		// Rename ctrl-2's variable to 'varA' (conflict)
		map.updateExpressionVariableName('ctrl-2', 'varB', 'varA')

		// ctrl-1 stays active for 'varA'
		expect(map.getControlIdByName('varA')).toBe('ctrl-1')
		// 'varB' is gone
		expect(map.getControlIdByName('varB')).toBeUndefined()
	})
})

// ── rebuildMap ────────────────────────────────────────────────────────────────

describe('rebuildMap', () => {
	test('empty controls map results in an empty name map', () => {
		const { map } = makeMap()
		map.rebuildMap()
		expect(map.getControlIdByName('anything')).toBeUndefined()
	})

	test('only ControlExpressionVariable instances are included', () => {
		const { map, controls } = makeMap()

		// A plain non-CVE object should be ignored by instanceof check
		controls.set('plain-ctrl', { controlId: 'plain-ctrl', options: { variableName: 'shouldBeIgnored' } })
		// A real CVE mock instance
		controls.set('cve-ctrl', makeCveControl('cve-ctrl', 'myVar'))

		map.rebuildMap()

		expect(map.getControlIdByName('shouldBeIgnored')).toBeUndefined()
		expect(map.getControlIdByName('myVar')).toBe('cve-ctrl')
	})

	test('controls with the same name are sorted by controlId for consistent conflict order', () => {
		const { map, controls } = makeMap()

		// 'z-ctrl' sorts after 'a-ctrl', so 'a-ctrl' should be active
		controls.set('z-ctrl', makeCveControl('z-ctrl', 'sharedVar'))
		controls.set('a-ctrl', makeCveControl('a-ctrl', 'sharedVar'))

		map.rebuildMap()

		expect(map.getControlIdByName('sharedVar')).toBe('a-ctrl')
	})
})

// ── isExpressionVariableActive ────────────────────────────────────────────────

describe('isExpressionVariableActive', () => {
	test('returns true for the active control', () => {
		const { map, controls } = makeMap()
		const ctrl = makeCveControl('ctrl-1', 'myVar')
		controls.set('ctrl-1', ctrl)
		map.addExpressionVariable('ctrl-1', 'myVar')

		expect(map.isExpressionVariableActive('ctrl-1')).toBe(true)
	})

	test('returns false for a conflicting (non-active) control', () => {
		const { map, controls } = makeMap()
		const ctrl2 = makeCveControl('ctrl-2', 'myVar')
		controls.set('ctrl-2', ctrl2)
		map.addExpressionVariable('ctrl-1', 'myVar')
		map.addExpressionVariable('ctrl-2', 'myVar')

		expect(map.isExpressionVariableActive('ctrl-2')).toBe(false)
	})

	test('returns false when control is not in the controls map', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		// 'ctrl-1' is not in the controls map
		expect(map.isExpressionVariableActive('ctrl-1')).toBe(false)
	})

	test('returns false when control has no variableName', () => {
		const { map, controls } = makeMap()
		// Control with empty variableName
		controls.set('ctrl-1', makeCveControl('ctrl-1', ''))
		expect(map.isExpressionVariableActive('ctrl-1')).toBe(false)
	})
})

// ── getControlIdByName ────────────────────────────────────────────────────────

describe('getControlIdByName', () => {
	test('returns the active controlId for a registered variable name', () => {
		const { map } = makeMap()
		map.addExpressionVariable('ctrl-1', 'myVar')
		expect(map.getControlIdByName('myVar')).toBe('ctrl-1')
	})

	test('returns undefined for a name that was never registered', () => {
		const { map } = makeMap()
		expect(map.getControlIdByName('unknown')).toBeUndefined()
	})
})
