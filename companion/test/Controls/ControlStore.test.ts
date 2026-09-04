import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreatePageControlId } from '@companion-app/shared/ControlId.js'
import { ControlStore } from '../../lib/Controls/ControlStore.js'

/** A mock control exposing only what ControlStore touches, with vi.fn spies for the methods it calls. */
function makeControl(
	opts: {
		controlId?: string
		supportsEntities?: boolean
		supportsActions?: boolean
		rotateResult?: boolean
		entityParser?: object
		localVariableEntities?: object[]
	} = {}
) {
	return {
		controlId: opts.controlId ?? 'bank:x',
		supportsEntities: opts.supportsEntities ?? false,
		supportsActions: opts.supportsActions ?? false,
		renameVariables: vi.fn(),
		pressControl: vi.fn(),
		rotateControl: vi.fn(() => opts.rotateResult ?? true),
		abortDelayedActions: vi.fn(),
		entities: {
			forgetConnection: vi.fn(),
			clearConnectionState: vi.fn(),
			updateFeedbackValues: vi.fn(),
			createVariablesAndExpressionParser: vi.fn(() => opts.entityParser ?? ({} as any)),
			getLocalVariableEntities: vi.fn(() => opts.localVariableEntities ?? []),
		},
	}
}

describe('ControlStore', () => {
	let tableView: { delete: ReturnType<typeof vi.fn> }
	let getTableView: ReturnType<typeof vi.fn>
	let createParser: ReturnType<typeof vi.fn>
	let getLocationOfControlId: ReturnType<typeof vi.fn>
	let getPageId: ReturnType<typeof vi.fn>
	let store: ControlStore

	beforeEach(() => {
		tableView = { delete: vi.fn() }
		getTableView = vi.fn(() => tableView)
		createParser = vi.fn(() => ({}) as any)
		getLocationOfControlId = vi.fn(() => null)
		getPageId = vi.fn(() => undefined)

		const db = { getTableView } as any
		const variablesValues = { createVariablesAndExpressionParser: createParser } as any
		const pageStore = { getLocationOfControlId, getPageId } as any

		store = new ControlStore(db, variablesValues, pageStore)
	})

	function addControl(controlId: string, opts: Parameters<typeof makeControl>[0] = {}) {
		const control = makeControl({ ...opts, controlId })
		store.controls.set(controlId, control as any)
		return control
	}

	describe('construction', () => {
		it('opens the controls table view', () => {
			expect(getTableView).toHaveBeenCalledWith('controls')
			expect(store.dbTable).toBe(tableView)
		})

		it('creates a trigger event bus', () => {
			expect(store.triggerEvents).toBeTruthy()
		})
	})

	describe('getControl', () => {
		it('returns a stored control', () => {
			const control = addControl('bank:1')
			expect(store.getControl('bank:1')).toBe(control)
		})

		it('returns undefined for a missing control', () => {
			expect(store.getControl('bank:missing')).toBeUndefined()
		})

		it('returns undefined for an empty id (without hitting the map)', () => {
			expect(store.getControl('')).toBeUndefined()
		})
	})

	describe('getAllControls', () => {
		it('returns every stored control', () => {
			const a = addControl('bank:1')
			const b = addControl('bank:2')
			const all = store.getAllControls()
			expect(all.size).toBe(2)
			expect(all.get('bank:1')).toBe(a)
			expect(all.get('bank:2')).toBe(b)
		})
	})

	describe('deleteControl', () => {
		it('removes the control from the map and the db table', () => {
			addControl('bank:1')
			store.deleteControl('bank:1')

			expect(store.getControl('bank:1')).toBeUndefined()
			expect(tableView.delete).toHaveBeenCalledWith('bank:1')
		})
	})

	describe('renameVariables', () => {
		it('renames across every control', () => {
			const a = addControl('bank:1')
			const b = addControl('bank:2')
			store.renameVariables('old', 'new')

			expect(a.renameVariables).toHaveBeenCalledWith('old', 'new')
			expect(b.renameVariables).toHaveBeenCalledWith('old', 'new')
		})
	})

	describe('forgetConnection', () => {
		it('forgets the connection only on entity-backed controls', () => {
			const withEntities = addControl('bank:1', { supportsEntities: true })
			const withoutEntities = addControl('bank:2', { supportsEntities: false })

			store.forgetConnection('conn1')

			expect(withEntities.entities.forgetConnection).toHaveBeenCalledWith('conn1')
			expect(withoutEntities.entities.forgetConnection).not.toHaveBeenCalled()
		})
	})

	describe('clearConnectionState', () => {
		it('clears state only on entity-backed controls', () => {
			const withEntities = addControl('bank:1', { supportsEntities: true })
			const withoutEntities = addControl('bank:2', { supportsEntities: false })

			store.clearConnectionState('conn1')

			expect(withEntities.entities.clearConnectionState).toHaveBeenCalledWith('conn1')
			expect(withoutEntities.entities.clearConnectionState).not.toHaveBeenCalled()
		})
	})

	describe('abortAllDelayedActions', () => {
		it('aborts only on action-backed controls, forwarding the exempt signal', () => {
			const withActions = addControl('bank:1', { supportsActions: true })
			const withoutActions = addControl('bank:2', { supportsActions: false })
			const signal = new AbortController().signal

			store.abortAllDelayedActions(signal)

			expect(withActions.abortDelayedActions).toHaveBeenCalledWith(false, signal)
			expect(withoutActions.abortDelayedActions).not.toHaveBeenCalled()
		})

		it('accepts a null signal', () => {
			const withActions = addControl('bank:1', { supportsActions: true })
			store.abortAllDelayedActions(null)
			expect(withActions.abortDelayedActions).toHaveBeenCalledWith(false, null)
		})
	})

	describe('pressControl', () => {
		it('emits control_press and forwards the press, returning true', () => {
			const control = addControl('bank:1')
			const pressListener = vi.fn()
			store.triggerEvents.on('control_press', pressListener)

			expect(store.pressControl('bank:1', true, 'surface1', true)).toBe(true)

			expect(pressListener).toHaveBeenCalledWith('bank:1', true, 'surface1')
			expect(control.pressControl).toHaveBeenCalledWith(true, 'surface1', true)
		})

		it('returns false and does not emit for a missing control', () => {
			const pressListener = vi.fn()
			store.triggerEvents.on('control_press', pressListener)

			expect(store.pressControl('bank:missing', true, 'surface1')).toBe(false)
			expect(pressListener).not.toHaveBeenCalled()
		})
	})

	describe('rotateControl', () => {
		it('forwards a valid rotation and returns the control result', () => {
			const control = addControl('bank:1', { rotateResult: true })
			expect(store.rotateControl('bank:1', 2, 'surface1')).toBe(true)
			expect(control.rotateControl).toHaveBeenCalledWith(2, 'surface1')
		})

		it('propagates a control that reports it did not handle the rotation', () => {
			addControl('bank:1', { rotateResult: false })
			expect(store.rotateControl('bank:1', -1, 'surface1')).toBe(false)
		})

		it('returns false for a missing control', () => {
			expect(store.rotateControl('bank:missing', 1, 'surface1')).toBe(false)
		})

		it.each([0, NaN, Infinity, -Infinity])('rejects a %s delta without touching the control', (delta) => {
			const control = addControl('bank:1')
			expect(store.rotateControl('bank:1', delta, 'surface1')).toBe(false)
			expect(control.rotateControl).not.toHaveBeenCalled()
		})
	})

	describe('updateFeedbackValues', () => {
		it('is a no-op for an empty result set', () => {
			const control = addControl('bank:1', { supportsEntities: true })
			store.updateFeedbackValues('conn1', [])
			expect(control.entities.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('groups values per control and dispatches to entity-backed controls', () => {
			const control = addControl('bank:1', { supportsEntities: true })
			const v1 = { controlId: 'bank:1', entityId: 'e1' } as any
			const v2 = { controlId: 'bank:1', entityId: 'e2' } as any

			store.updateFeedbackValues('conn1', [v1, v2])

			expect(control.entities.updateFeedbackValues).toHaveBeenCalledTimes(1)
			const [connectionId, valuesMap] = control.entities.updateFeedbackValues.mock.calls[0]
			expect(connectionId).toBe('conn1')
			expect(valuesMap.get('e1')).toBe(v1)
			expect(valuesMap.get('e2')).toBe(v2)
		})

		it('skips controls that do not support entities or are missing', () => {
			const noEntities = addControl('bank:1', { supportsEntities: false })

			store.updateFeedbackValues('conn1', [
				{ controlId: 'bank:1', entityId: 'e1' } as any,
				{ controlId: 'bank:missing', entityId: 'e2' } as any,
			])

			expect(noEntities.entities.updateFeedbackValues).not.toHaveBeenCalled()
		})
	})

	// The grid location sourced here feeds the `this:*` variables. A control with an entity pool uses its own
	// parser; a located control without one (e.g. a button reference) must still have its location injected so
	// `$(this:page)` resolves rather than yielding `$NA`.
	describe('createVariablesAndExpressionParser', () => {
		it('injects the grid location for a located control without an entity pool', () => {
			const location = { pageNumber: 3, row: 1, column: 2 }
			getLocationOfControlId.mockReturnValue(location)
			addControl('bank:1', { supportsEntities: false })

			store.createVariablesAndExpressionParser('bank:1', null)

			expect(getLocationOfControlId).toHaveBeenCalledWith('bank:1')
			expect(createParser).toHaveBeenCalledWith(location, null, null, null, undefined)
		})

		it('injects the location even when the control is not (yet) in the store', () => {
			const location = { pageNumber: 1, row: 0, column: 0 }
			getLocationOfControlId.mockReturnValue(location)

			store.createVariablesAndExpressionParser('bank:9', null)

			expect(createParser).toHaveBeenCalledWith(location, null, null, null, undefined)
		})

		it("injects the page's variable entities for a located control without an entity pool", () => {
			const location = { pageNumber: 3, row: 1, column: 2 }
			getLocationOfControlId.mockReturnValue(location)
			getPageId.mockImplementation((pageNumber: number) => (pageNumber === 3 ? 'page-abc' : undefined))

			const pageEntities = [{ id: 'pv1' }]
			addControl(CreatePageControlId('page-abc'), { supportsEntities: true, localVariableEntities: pageEntities })
			addControl('bank:1', { supportsEntities: false })

			store.createVariablesAndExpressionParser('bank:1', null)

			expect(getPageId).toHaveBeenCalledWith(3)
			expect(createParser).toHaveBeenCalledWith(location, null, null, pageEntities, undefined)
		})

		it('forwards override values and parser options on the generic path', () => {
			const overrides = { 'custom:x': 5 } as any
			const options = { marker: true } as any
			store.createVariablesAndExpressionParser(null, overrides, options)

			expect(createParser).toHaveBeenCalledWith(null, null, overrides, null, options)
		})

		it('passes a null location when there is no control id', () => {
			store.createVariablesAndExpressionParser(null, null)

			expect(getLocationOfControlId).not.toHaveBeenCalled()
			expect(createParser).toHaveBeenCalledWith(null, null, null, null, undefined)
		})

		it('defers to the entity pool parser when the control supports entities', () => {
			const entityParser = {} as any
			const control = addControl('bank:2', { supportsEntities: true, entityParser })
			const overrides = { 'custom:y': 1 } as any

			const result = store.createVariablesAndExpressionParser('bank:2', overrides)

			expect(result).toBe(entityParser)
			expect(control.entities.createVariablesAndExpressionParser).toHaveBeenCalledWith(overrides, undefined)
			expect(createParser).not.toHaveBeenCalled()
			expect(getLocationOfControlId).not.toHaveBeenCalled()
		})
	})
})
