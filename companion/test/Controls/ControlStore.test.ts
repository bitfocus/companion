import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	CreateBankControlId,
	CreatePageControlId,
	CreateTriggerControlId,
	formatLocation,
	type SomeControlId,
} from '@companion-app/shared/ControlId.js'
import { SomeControlModelSchema } from '@companion-app/shared/Model/Controls.js'
import { INVALID_ENTITY_DEFINITION_ID } from '@companion-app/shared/Model/EntityModel.js'
import { ControlStore } from '../../lib/Controls/ControlStore.js'
import { DataDatabase } from '../../lib/Data/Database.js'
import { BROKEN_ROWS_TABLE, type BrokenRowRecord } from '../../lib/Data/Tables/ParsedTableViewBase.js'

/** A mock control exposing only what ControlStore touches, with vi.fn spies for the methods it calls. */
function makeControl(
	opts: {
		controlId?: SomeControlId
		supportsEntities?: boolean
		supportsActions?: boolean
		rotateResult?: boolean
		referenceTargetControlId?: string | null
		entityParser?: object
		localVariableEntities?: object[]
	} = {}
) {
	return {
		controlId: opts.controlId ?? CreateBankControlId('x'),
		supportsEntities: opts.supportsEntities ?? false,
		supportsActions: opts.supportsActions ?? false,
		renameVariables: vi.fn(),
		pressControl: vi.fn(),
		rotateControl: vi.fn(() => opts.rotateResult ?? true),
		getReferenceTargetControlId: vi.fn(() => opts.referenceTargetControlId ?? null),
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
	let getSchemaTableView: ReturnType<typeof vi.fn>
	let createParser: ReturnType<typeof vi.fn>
	let getLocationOfControlId: ReturnType<typeof vi.fn>
	let getPageId: ReturnType<typeof vi.fn>
	let store: ControlStore

	beforeEach(() => {
		tableView = { delete: vi.fn() }
		getSchemaTableView = vi.fn(() => tableView)
		createParser = vi.fn(() => ({}) as any)
		getLocationOfControlId = vi.fn(() => null)
		getPageId = vi.fn(() => undefined)

		const db = { getSchemaTableView } as any
		const variablesValues = { createVariablesAndExpressionParser: createParser } as any
		const pageStore = { getLocationOfControlId, getPageId } as any

		store = new ControlStore(db, variablesValues, pageStore)
	})

	function addControl(controlId: SomeControlId, opts: Parameters<typeof makeControl>[0] = {}) {
		const control = makeControl({ ...opts, controlId })
		store.controls.set(controlId, control as any)
		return control
	}

	describe('construction', () => {
		it('opens the controls table, checked when read, and repaired if it fails', () => {
			expect(getSchemaTableView).toHaveBeenCalledWith('controls', SomeControlModelSchema, {
				key: expect.objectContaining({ schema: expect.anything() }),
				validateWrites: false,
				repair: expect.any(Function),
			})
			expect(store.dbTable).toBe(tableView)
		})

		it('repairs a stored control with an invalid entity, rather than losing it', () => {
			const db = new DataDatabase(':memory:', () => {})
			db.getTableView<Record<string, any>>('controls').set(CreateBankControlId('1'), {
				type: 'button-layered',
				feedbacks: [{ type: 'feedback', id: 'f1', definitionId: 'state', connectionId: 5, options: {} }],
			})

			const realStore = new ControlStore(db, {} as any, {} as any)
			const control = realStore.dbTable.get(CreateBankControlId('1'))

			expect(control).toMatchObject({
				type: 'button-layered',
				feedbacks: [{ type: 'feedback', id: 'f1', definitionId: INVALID_ENTITY_DEFINITION_ID, disabled: true }],
			})
			// And the repair is stored
			expect(
				db.getTableView<Record<string, any>>('controls').get(CreateBankControlId('1')).feedbacks[0].definitionId
			).toBe(INVALID_ENTITY_DEFINITION_ID)
			db.close()
		})

		it("moves aside a stored control whose id is invalid, or doesn't suit its type", () => {
			const db = new DataDatabase(':memory:', () => {})
			const rawControls = db.getTableView<Record<string, any>>('controls')
			rawControls.set(CreateBankControlId('1'), { type: 'pageup' })
			rawControls.set(CreateTriggerControlId('1'), { type: 'pageup' })
			rawControls.set('nonsense', { type: 'pageup' })

			const realStore = new ControlStore(db, {} as any, {} as any)

			expect(realStore.dbTable.entries()).toEqual([[CreateBankControlId('1'), { type: 'pageup' }]])
			expect(Object.keys(rawControls.all())).toEqual([CreateBankControlId('1')])
			expect(
				Object.values(db.getTableView<Record<string, BrokenRowRecord>>(BROKEN_ROWS_TABLE).all())
					.map((row) => [row.rowId, row.reason])
					.sort()
			).toEqual([
				['nonsense', expect.stringMatching(/^Invalid key/)],
				[CreateTriggerControlId('1'), 'A control of type "pageup" must have a bank id'],
			])
			db.close()
		})

		it('creates a trigger event bus', () => {
			expect(store.triggerEvents).toBeTruthy()
		})
	})

	describe('getControl', () => {
		it('returns a stored control', () => {
			const control = addControl(CreateBankControlId('1'))
			expect(store.getControl(CreateBankControlId('1'))).toBe(control)
		})

		it('returns undefined for a missing control', () => {
			expect(store.getControl(CreateBankControlId('missing'))).toBeUndefined()
		})
	})

	describe('getControlFollowingReferences', () => {
		it('returns a non-reference control directly', () => {
			const control = addControl(CreateBankControlId('1'))
			expect(store.getControlFollowingReferences(CreateBankControlId('1'))).toBe(control)
		})

		it('follows a chain of references to the target', () => {
			addControl(CreateBankControlId('ref1'), { referenceTargetControlId: CreateBankControlId('ref2') })
			addControl(CreateBankControlId('ref2'), { referenceTargetControlId: CreateBankControlId('target') })
			const target = addControl(CreateBankControlId('target'))
			expect(store.getControlFollowingReferences(CreateBankControlId('ref1'))).toBe(target)
		})

		it('returns undefined for a reference to a missing control', () => {
			addControl(CreateBankControlId('ref'), { referenceTargetControlId: CreateBankControlId('missing') })
			expect(store.getControlFollowingReferences(CreateBankControlId('ref'))).toBeUndefined()
		})

		it('returns undefined for a reference cycle', () => {
			addControl(CreateBankControlId('ref1'), { referenceTargetControlId: CreateBankControlId('ref2') })
			addControl(CreateBankControlId('ref2'), { referenceTargetControlId: CreateBankControlId('ref1') })
			expect(store.getControlFollowingReferences(CreateBankControlId('ref1'))).toBeUndefined()
		})

		it('returns undefined for a null id', () => {
			expect(store.getControlFollowingReferences(null)).toBeUndefined()
		})
	})

	describe('getAllControls', () => {
		it('returns every stored control', () => {
			const a = addControl(CreateBankControlId('1'))
			const b = addControl(CreateBankControlId('2'))
			const all = store.getAllControls()
			expect(all.size).toBe(2)
			expect(all.get(CreateBankControlId('1'))).toBe(a)
			expect(all.get(CreateBankControlId('2'))).toBe(b)
		})
	})

	describe('deleteControl', () => {
		it('removes the control from the map and the db table', () => {
			addControl(CreateBankControlId('1'))
			store.deleteControl(CreateBankControlId('1'))

			expect(store.getControl(CreateBankControlId('1'))).toBeUndefined()
			expect(tableView.delete).toHaveBeenCalledWith(CreateBankControlId('1'))
		})

		it('forgets the locations the control referenced', () => {
			addControl(CreateBankControlId('1'))
			store.referencedLocations.setControlReferences(
				CreateBankControlId('1'),
				new Set([formatLocation({ pageNumber: 1, row: 0, column: 0 })])
			)
			store.deleteControl(CreateBankControlId('1'))

			expect(
				store.referencedLocations.getControlsReferencing(formatLocation({ pageNumber: 1, row: 0, column: 0 }))
			).toBeUndefined()
		})
	})

	describe('renameVariables', () => {
		it('renames across every control', () => {
			const a = addControl(CreateBankControlId('1'))
			const b = addControl(CreateBankControlId('2'))
			store.renameVariables('old', 'new')

			expect(a.renameVariables).toHaveBeenCalledWith('old', 'new')
			expect(b.renameVariables).toHaveBeenCalledWith('old', 'new')
		})
	})

	describe('forgetConnection', () => {
		it('forgets the connection only on entity-backed controls', () => {
			const withEntities = addControl(CreateBankControlId('1'), { supportsEntities: true })
			const withoutEntities = addControl(CreateBankControlId('2'), { supportsEntities: false })

			store.forgetConnection('conn1')

			expect(withEntities.entities.forgetConnection).toHaveBeenCalledWith('conn1')
			expect(withoutEntities.entities.forgetConnection).not.toHaveBeenCalled()
		})
	})

	describe('clearConnectionState', () => {
		it('clears state only on entity-backed controls', () => {
			const withEntities = addControl(CreateBankControlId('1'), { supportsEntities: true })
			const withoutEntities = addControl(CreateBankControlId('2'), { supportsEntities: false })

			store.clearConnectionState('conn1')

			expect(withEntities.entities.clearConnectionState).toHaveBeenCalledWith('conn1')
			expect(withoutEntities.entities.clearConnectionState).not.toHaveBeenCalled()
		})
	})

	describe('abortAllDelayedActions', () => {
		it('aborts every control, forwarding the exempt signal', () => {
			const withActions = addControl(CreateBankControlId('1'), { supportsActions: true })
			// Eg a remote button, which forwards it
			const withoutActions = addControl(CreateBankControlId('2'), { supportsActions: false })
			const signal = new AbortController().signal

			store.abortAllDelayedActions(signal)

			expect(withActions.abortDelayedActions).toHaveBeenCalledWith(false, signal, 0)
			expect(withoutActions.abortDelayedActions).toHaveBeenCalledWith(false, signal, 0)
		})

		it('accepts a null signal', () => {
			const withActions = addControl(CreateBankControlId('1'), { supportsActions: true })
			store.abortAllDelayedActions(null)
			expect(withActions.abortDelayedActions).toHaveBeenCalledWith(false, null, 0)
		})
	})

	describe('pressControl', () => {
		it('emits control_press and forwards the press, returning true', () => {
			const control = addControl(CreateBankControlId('1'))
			const pressListener = vi.fn()
			store.triggerEvents.on('control_press', pressListener)

			expect(store.pressControl(CreateBankControlId('1'), true, 'surface1', true)).toBe(true)

			expect(pressListener).toHaveBeenCalledWith(CreateBankControlId('1'), true, 'surface1')
			expect(control.pressControl).toHaveBeenCalledWith(true, 'surface1', true)
		})

		it('returns false and does not emit for a missing control', () => {
			const pressListener = vi.fn()
			store.triggerEvents.on('control_press', pressListener)

			expect(store.pressControl(CreateBankControlId('missing'), true, 'surface1')).toBe(false)
			expect(pressListener).not.toHaveBeenCalled()
		})
	})

	describe('rotateControl', () => {
		it('forwards a valid rotation and returns the control result', () => {
			const control = addControl(CreateBankControlId('1'), { rotateResult: true })
			expect(store.rotateControl(CreateBankControlId('1'), 2, 'surface1')).toBe(true)
			expect(control.rotateControl).toHaveBeenCalledWith(2, 'surface1')
		})

		it('propagates a control that reports it did not handle the rotation', () => {
			addControl(CreateBankControlId('1'), { rotateResult: false })
			expect(store.rotateControl(CreateBankControlId('1'), -1, 'surface1')).toBe(false)
		})

		it('returns false for a missing control', () => {
			expect(store.rotateControl(CreateBankControlId('missing'), 1, 'surface1')).toBe(false)
		})

		it.each([0, NaN, Infinity, -Infinity])('rejects a %s delta without touching the control', (delta) => {
			const control = addControl(CreateBankControlId('1'))
			expect(store.rotateControl(CreateBankControlId('1'), delta, 'surface1')).toBe(false)
			expect(control.rotateControl).not.toHaveBeenCalled()
		})
	})

	describe('updateFeedbackValues', () => {
		it('is a no-op for an empty result set', () => {
			const control = addControl(CreateBankControlId('1'), { supportsEntities: true })
			store.updateFeedbackValues('conn1', [])
			expect(control.entities.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('groups values per control and dispatches to entity-backed controls', () => {
			const control = addControl(CreateBankControlId('1'), { supportsEntities: true })
			const v1 = { controlId: CreateBankControlId('1'), entityId: 'e1' } as any
			const v2 = { controlId: CreateBankControlId('1'), entityId: 'e2' } as any

			store.updateFeedbackValues('conn1', [v1, v2])

			expect(control.entities.updateFeedbackValues).toHaveBeenCalledTimes(1)
			const [connectionId, valuesMap] = control.entities.updateFeedbackValues.mock.calls[0]
			expect(connectionId).toBe('conn1')
			expect(valuesMap.get('e1')).toBe(v1)
			expect(valuesMap.get('e2')).toBe(v2)
		})

		it('skips controls that do not support entities or are missing', () => {
			const noEntities = addControl(CreateBankControlId('1'), { supportsEntities: false })

			store.updateFeedbackValues('conn1', [
				{ controlId: CreateBankControlId('1'), entityId: 'e1' } as any,
				{ controlId: CreateBankControlId('missing'), entityId: 'e2' } as any,
			])

			expect(noEntities.entities.updateFeedbackValues).not.toHaveBeenCalled()
		})
	})

	// The grid location sourced here feeds the `this:*` variables. A control with an entity pool uses its own
	// parser; a located control without one (e.g. a button reference) must still have its location injected so
	// `$(this:page)` resolves rather than yielding `$NA`.
	describe('createActionExecutionParser', () => {
		it('uses the execution overrides and rejects clock sensitive expressions', () => {
			const entityParser = {} as any
			const control = addControl(CreateBankControlId('2'), { supportsEntities: true, entityParser })

			const result = store.createActionExecutionParser({
				controlId: CreateBankControlId('2'),
				surfaceId: 'surface0',
				location: undefined,
				abortDelayed: new AbortController().signal,
				executionMode: 'concurrent',
				rotationDelta: 2,
				frame: null,
			})

			expect(result).toBe(entityParser)
			expect(control.entities.createVariablesAndExpressionParser).toHaveBeenCalledWith(
				{ 'this:surface_id': 'surface0', 'this:delta': 2 },
				{ allowClockSensitive: false }
			)
		})
	})

	describe('createVariablesAndExpressionParser', () => {
		it('injects the grid location for a located control without an entity pool', () => {
			const location = { pageNumber: 3, row: 1, column: 2 }
			getLocationOfControlId.mockReturnValue(location)
			addControl(CreateBankControlId('1'), { supportsEntities: false })

			store.createVariablesAndExpressionParser(CreateBankControlId('1'), null)

			expect(getLocationOfControlId).toHaveBeenCalledWith(CreateBankControlId('1'))
			expect(createParser).toHaveBeenCalledWith(location, null, null, null, undefined)
		})

		it('injects the location even when the control is not (yet) in the store', () => {
			const location = { pageNumber: 1, row: 0, column: 0 }
			getLocationOfControlId.mockReturnValue(location)

			store.createVariablesAndExpressionParser(CreateBankControlId('9'), null)

			expect(createParser).toHaveBeenCalledWith(location, null, null, null, undefined)
		})

		it("injects the page's variable entities for a located control without an entity pool", () => {
			const location = { pageNumber: 3, row: 1, column: 2 }
			getLocationOfControlId.mockReturnValue(location)
			getPageId.mockImplementation((pageNumber: number) => (pageNumber === 3 ? 'page-abc' : undefined))

			const pageEntities = [{ id: 'pv1' }]
			addControl(CreatePageControlId('page-abc'), { supportsEntities: true, localVariableEntities: pageEntities })
			addControl(CreateBankControlId('1'), { supportsEntities: false })

			store.createVariablesAndExpressionParser(CreateBankControlId('1'), null)

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
			const control = addControl(CreateBankControlId('2'), { supportsEntities: true, entityParser })
			const overrides = { 'custom:y': 1 } as any

			const result = store.createVariablesAndExpressionParser(CreateBankControlId('2'), overrides)

			expect(result).toBe(entityParser)
			expect(control.entities.createVariablesAndExpressionParser).toHaveBeenCalledWith(overrides, undefined)
			expect(createParser).not.toHaveBeenCalled()
			expect(getLocationOfControlId).not.toHaveBeenCalled()
		})
	})
})
